import * as XLSX from "@e965/xlsx";

export const PROJECT_IMPORT_MAX_FILE_SIZE = 10 * 1024 * 1024;

export type ProjectImportKind = "subproject" | "main_goal" | "goal" | "objective";
export type ProjectImportField =
  | "level"
  | "name"
  | "project"
  | "subproject"
  | "mainGoal"
  | "goal"
  | "objective"
  | "description"
  | "id"
  | "parent"
  | "status"
  | "startDate"
  | "dueDate"
  | "priority";
export type ProjectImportMappings = Record<ProjectImportField, number | null>;

export type ProjectImportColumn = { index: number; label: string };
export type ProjectImportSheet = {
  name: string;
  columns: ProjectImportColumn[];
  rows: unknown[][];
  indentation?: number[];
  formulaWarnings: string[];
};
export type ProjectImportWorkbook = { sheets: ProjectImportSheet[] };

export type ProjectImportItem = {
  key: string;
  sourceRow: number;
  kind: ProjectImportKind;
  title: string;
  description: string;
  status: string;
  priority: string;
  startDate: string;
  dueDate: string;
  parentKey: string | null;
  parentReference: string;
  sourceId: string;
  warnings: string[];
  errors: string[];
  excluded: boolean;
  needsKindReview: boolean;
};

export type ProjectImportPreview = {
  sheetName: string;
  mappings: ProjectImportMappings;
  items: ProjectImportItem[];
  unparsedRows: number[];
  warnings: string[];
  errors: string[];
};

export const PROJECT_IMPORT_FIELDS: { key: ProjectImportField; label: string }[] = [
  { key: "level", label: "Level / item type" },
  { key: "name", label: "Item name (row-based sheets)" },
  { key: "project", label: "Main project" },
  { key: "subproject", label: "Subproject" },
  { key: "mainGoal", label: "Main goal" },
  { key: "goal", label: "Goal" },
  { key: "objective", label: "Objective / task" },
  { key: "description", label: "Description" },
  { key: "id", label: "Item identifier" },
  { key: "parent", label: "Parent identifier or name" },
  { key: "status", label: "Status" },
  { key: "startDate", label: "Start date" },
  { key: "dueDate", label: "Due date" },
  { key: "priority", label: "Priority" },
];

const IMPORT_FIELDS = PROJECT_IMPORT_FIELDS.map(({ key }) => key);

const FIELD_ALIASES: Record<ProjectImportField, string[]> = {
  level: ["level", "item type", "record type", "hierarchy level", "niveau", "type d element"],
  name: ["name", "title", "item name", "nom", "titre"],
  project: ["project", "main project", "project name", "projet", "projet principal"],
  subproject: [
    "subproject",
    "sub project",
    "subproject name",
    "sub-project",
    "sous projet",
    "nom du sous projet",
  ],
  mainGoal: ["main goal", "parent goal", "primary goal", "objectif principal", "but principal"],
  goal: ["goal", "goal name", "but", "objectif"],
  objective: [
    "objective",
    "task",
    "action",
    "sub objective",
    "objective name",
    "tache",
    "action a mener",
    "sous objectif",
  ],
  description: ["description", "details", "detail", "notes", "description detaillee"],
  id: ["id", "identifier", "item id", "record id", "identifiant"],
  parent: ["parent", "parent id", "parent name", "parent identifier", "parent item"],
  status: ["status", "state", "statut", "etat"],
  startDate: ["start date", "start", "date de debut", "debut"],
  dueDate: [
    "due date",
    "deadline",
    "target date",
    "end date",
    "date limite",
    "echeance",
    "date de fin",
  ],
  priority: ["priority", "priorite"],
};

const EMPTY_MAPPINGS = (): ProjectImportMappings => ({
  level: null,
  name: null,
  project: null,
  subproject: null,
  mainGoal: null,
  goal: null,
  objective: null,
  description: null,
  id: null,
  parent: null,
  status: null,
  startDate: null,
  dueDate: null,
  priority: null,
});

export async function readProjectWorkbook(file: File): Promise<ProjectImportWorkbook> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "xls" && extension !== "xlsx") {
    throw new Error("Choose an Excel workbook in .xls or .xlsx format.");
  }
  if (file.size === 0) throw new Error("The selected workbook is empty.");
  if (file.size > PROJECT_IMPORT_MAX_FILE_SIZE) {
    throw new Error("The workbook is too large. The maximum supported size is 10 MB.");
  }
  const allowedTypes = [
    "",
    "application/zip",
    "application/octet-stream",
    "application/x-cfb",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("The selected file is not recognized as an Excel workbook.");
  }

  const bytes = await file.arrayBuffer();
  if (!hasExcelSignature(bytes, extension)) {
    throw new Error("This workbook could not be read. It may be corrupted or password protected.");
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, {
      type: "array",
      cellDates: true,
      cellFormula: true,
      cellStyles: true,
      bookVBA: false,
    });
  } catch {
    throw new Error("This workbook could not be read. It may be corrupted or password protected.");
  }

  if (workbook.SheetNames.length === 0) {
    throw new Error("This workbook does not contain any worksheets.");
  }

  return {
    sheets: workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      if (!sheet) return { name, columns: [], rows: [], formulaWarnings: [] };
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
        raw: true,
        blankrows: true,
      });
      const columns = Array.from(
        { length: Math.max(0, ...rows.map((row) => row.length)) },
        (_, i) => ({
          index: i,
          label: columnLabel(i),
        }),
      );
      return {
        name,
        columns,
        rows,
        indentation: rows.map((row, index) => rowIndentation(sheet, index, row)),
        formulaWarnings: findFormulaWarnings(sheet),
      };
    }),
  };
}

export function suggestProjectImportSheet(workbook: ProjectImportWorkbook): string {
  return (
    [...workbook.sheets].sort((a, b) => scoreHeaderRows(b.rows) - scoreHeaderRows(a.rows))[0]
      ?.name ?? ""
  );
}

export function detectProjectImportMappings(sheet: ProjectImportSheet): ProjectImportMappings {
  const mappings = EMPTY_MAPPINGS();
  const headerIndex = findHeaderRow(sheet.rows);
  if (headerIndex < 0) return mappings;
  const headers = sheet.rows[headerIndex] ?? [];
  for (const field of IMPORT_FIELDS) {
    const aliases = FIELD_ALIASES[field].map(normalizeLabel);
    const index = headers.findIndex((value) =>
      aliases.includes(normalizeLabel(stringValue(value))),
    );
    if (index >= 0) mappings[field] = index;
  }
  return mappings;
}

export function projectImportHeaderRow(sheet: ProjectImportSheet) {
  return findHeaderRow(sheet.rows);
}

export function buildProjectImportPreview(
  sheet: ProjectImportSheet,
  projectName: string,
  mappings = detectProjectImportMappings(sheet),
): ProjectImportPreview {
  const headerIndex = findHeaderRow(sheet.rows);
  const errors: string[] = [];
  const warnings = [...sheet.formulaWarnings];
  if (headerIndex < 0) {
    return {
      sheetName: sheet.name,
      mappings,
      items: [],
      unparsedRows: [],
      warnings,
      errors: ["Could not identify a header row. Check that the worksheet has column headings."],
    };
  }

  const dataRows = sheet.rows
    .map((values, index) => ({ values, rowNumber: index + 1 }))
    .slice(headerIndex + 1)
    .filter(({ values }) => values.some((value) => stringValue(value).trim() !== ""));
  if (dataRows.length === 0) {
    errors.push("The selected worksheet has no data rows.");
    return { sheetName: sheet.name, mappings, items: [], unparsedRows: [], warnings, errors };
  }

  const hasMatrixColumns = ["subproject", "mainGoal", "goal", "objective"].some(
    (field) => mappings[field as keyof ProjectImportMappings] !== null,
  );
  const matrixHasValues =
    hasMatrixColumns &&
    dataRows.some(({ values }) =>
      ["subproject", "mainGoal", "goal", "objective"].some((field) =>
        cellText(values, mappings[field as keyof ProjectImportMappings]).trim(),
      ),
    );

  const items: ProjectImportItem[] = [];
  const unparsedRows: number[] = [];
  const matrixIndex = new Map<string, ProjectImportItem>();
  let currentSubproject: ProjectImportItem | null = null;
  let currentMainGoal: ProjectImportItem | null = null;
  let currentGoal: ProjectImportItem | null = null;

  function createItem(
    kind: ProjectImportKind,
    title: string,
    sourceRow: number,
    parentKey: string | null,
    values: unknown[],
    ordinal: number,
  ) {
    const item: ProjectImportItem = {
      key: `row-${sourceRow}-${kind}-${ordinal}`,
      sourceRow,
      kind,
      title,
      description: "",
      status: "",
      priority: "",
      startDate: "",
      dueDate: "",
      parentKey,
      parentReference: "",
      sourceId: "",
      warnings: [],
      errors: title.trim() ? [] : ["A name is required."],
      excluded: false,
      needsKindReview: false,
    };
    item.description = cellText(values, mappings.description).trim();
    item.status = cellText(values, mappings.status).trim();
    item.priority = cellText(values, mappings.priority).trim();
    item.startDate = normalizeDate(valueAt(values, mappings.startDate), item);
    item.dueDate = normalizeDate(valueAt(values, mappings.dueDate), item);
    if (kind !== "subproject" && item.startDate) {
      item.warnings.push("Start dates are only supported for subprojects and were not imported.");
    }
    if ((kind === "main_goal" || kind === "goal") && item.priority) {
      item.warnings.push("Priority is not supported for goals and was not imported.");
    }
    item.sourceId = cellText(values, mappings.id).trim();
    item.parentReference = cellText(values, mappings.parent).trim();
    return item;
  }

  if (matrixHasValues) {
    for (const { values, rowNumber } of dataRows) {
      const rowItemsStart = items.length;
      const projectCell = cellText(values, mappings.project).trim();
      if (projectCell && normalizeLabel(projectCell) !== normalizeLabel(projectName)) {
        warnings.push(
          `Row ${rowNumber}: workbook project "${projectCell}" differs from "${projectName}". Items will be imported into the open project.`,
        );
      }
      let ordinal = 0;
      const addMatrixItem = (
        kind: ProjectImportKind,
        title: string,
        parent: ProjectImportItem | null,
      ) => {
        if (!title.trim()) return null;
        const dedupeKey = `${kind}\u0000${parent?.key ?? ""}\u0000${normalizeLabel(title)}`;
        let item = matrixIndex.get(dedupeKey);
        if (!item) {
          item = createItem(kind, title.trim(), rowNumber, parent?.key ?? null, values, ordinal++);
          matrixIndex.set(dedupeKey, item);
          items.push(item);
        } else {
          const description = cellText(values, mappings.description).trim();
          if (description && !item.description) item.description = description;
        }
        return item;
      };

      const subprojectValue = cellText(values, mappings.subproject).trim();
      if (subprojectValue) {
        currentSubproject = addMatrixItem("subproject", subprojectValue, null);
        currentMainGoal = null;
        currentGoal = null;
      }
      const mainGoalValue = cellText(values, mappings.mainGoal).trim();
      if (mainGoalValue) {
        currentMainGoal = addMatrixItem("main_goal", mainGoalValue, currentSubproject);
        currentGoal = null;
      }
      const goalValue = cellText(values, mappings.goal).trim();
      if (goalValue) {
        const parent = currentMainGoal ?? currentSubproject;
        currentGoal = addMatrixItem("goal", goalValue, parent);
      }
      const objectiveValue = cellText(values, mappings.objective).trim();
      if (objectiveValue) {
        const parentGoal = currentGoal ?? currentMainGoal;
        const item = addMatrixItem("objective", objectiveValue, parentGoal);
        if (!parentGoal && item) {
          item.errors.push("Choose a goal parent for this objective.");
        }
      }

      const createdOnRow = items.slice(rowItemsStart);
      if (createdOnRow.length > 0) {
        for (const earlierItem of createdOnRow.slice(0, -1)) {
          earlierItem.description = "";
          earlierItem.status = "";
          earlierItem.priority = "";
          earlierItem.startDate = "";
          earlierItem.dueDate = "";
          earlierItem.sourceId = "";
          earlierItem.parentReference = "";
          earlierItem.warnings = [];
        }
        const rowLeaf = createdOnRow[createdOnRow.length - 1];
        if (rowLeaf) {
          rowLeaf.sourceRow = rowNumber;
          rowLeaf.sourceId = cellText(values, mappings.id).trim() || rowLeaf.sourceId;
          rowLeaf.parentReference =
            cellText(values, mappings.parent).trim() || rowLeaf.parentReference;
        }
      } else if (projectCell) {
        continue;
      } else if (
        ["subproject", "mainGoal", "goal", "objective"].some((field) =>
          cellText(values, mappings[field as keyof ProjectImportMappings]).trim(),
        )
      ) {
        warnings.push(
          `Row ${rowNumber}: repeats items already recognized in the hierarchy; verify that it is not a duplicate.`,
        );
      } else {
        unparsedRows.push(rowNumber);
      }
    }
  } else {
    for (const { values, rowNumber } of dataRows) {
      const title = cellText(values, mappings.name).trim();
      const level = cellText(values, mappings.level).trim();
      let kind = importKind(level);
      const projectCell = cellText(values, mappings.project).trim();
      if (projectCell && normalizeLabel(projectCell) !== normalizeLabel(projectName)) {
        warnings.push(
          `Row ${rowNumber}: workbook project "${projectCell}" differs from "${projectName}". Items will be imported into the open project.`,
        );
      }
      if (!kind) {
        if (
          ["project", "main project", "projet", "projet principal"].includes(normalizeLabel(level))
        ) {
          if (title && normalizeLabel(title) !== normalizeLabel(projectName)) {
            warnings.push(
              `Row ${rowNumber}: project "${title}" differs from "${projectName}" and was not imported as a new project.`,
            );
          }
          continue;
        }
        if (!title || level) {
          unparsedRows.push(rowNumber);
          continue;
        }
        kind = inferredKind(sheet.indentation?.[rowNumber - 1] ?? 0);
      }
      let parent: ProjectImportItem | null = null;
      if (kind === "main_goal") parent = currentSubproject;
      if (kind === "goal") parent = currentMainGoal ?? currentSubproject;
      if (kind === "objective") parent = currentGoal ?? currentMainGoal;
      const item = createItem(kind, title, rowNumber, parent?.key ?? null, values, 0);
      if (!importKind(level)) {
        item.needsKindReview = true;
        item.errors.push("Choose the item's hierarchy level before importing.");
        item.warnings.push("The level was inferred from indentation or row structure; verify it.");
      }
      items.push(item);
      if (kind === "subproject") {
        currentSubproject = item;
        currentMainGoal = null;
        currentGoal = null;
      } else if (kind === "main_goal") {
        currentMainGoal = item;
        currentGoal = null;
      } else if (kind === "goal") {
        currentGoal = item;
      } else if (!parent) {
        item.errors.push("Choose a goal parent for this objective.");
      }
    }
  }

  resolveExplicitParents(items, mappings, sheet, headerIndex);
  reportDuplicates(items);
  if (unparsedRows.length > 0) {
    warnings.push(
      `${unparsedRows.length} row${unparsedRows.length === 1 ? "" : "s"} could not be interpreted and were not added.`,
    );
  }
  if (!Object.values(mappings).some((index) => index !== null)) {
    errors.push("No columns are mapped. Assign at least the level/name or hierarchy columns.");
  }
  return { sheetName: sheet.name, mappings, items, unparsedRows, warnings, errors };
}

export function validateProjectImportItems(items: ProjectImportItem[]): string[] {
  const issues: string[] = [];
  const active = items.filter((item) => !item.excluded);
  const byKey = new Map(active.map((item) => [item.key, item]));
  for (const item of active) {
    if (!item.title.trim()) issues.push(`Row ${item.sourceRow}: add a name.`);
    if (item.needsKindReview)
      issues.push(`Row ${item.sourceRow}: choose the item's hierarchy level.`);
    if (item.errors.length > 0) {
      issues.push(`Row ${item.sourceRow}: ${item.errors.join(" ")}`);
    }
    if (item.parentKey) {
      const parent = byKey.get(item.parentKey);
      if (!parent) {
        issues.push(`Row ${item.sourceRow}: choose an included parent.`);
      } else if (!isValidParent(item.kind, parent.kind)) {
        issues.push(`Row ${item.sourceRow}: the selected parent type is not valid for this item.`);
      }
    } else if (item.kind === "objective") {
      issues.push(`Row ${item.sourceRow}: choose a goal parent for this objective.`);
    }
    if (item.parentReference) {
      const matched = active.find(
        (candidate) =>
          candidate.sourceId === item.parentReference ||
          normalizeLabel(candidate.title) === normalizeLabel(item.parentReference),
      );
      if (!matched) issues.push(`Row ${item.sourceRow}: resolve parent "${item.parentReference}".`);
      else if (item.parentKey !== matched.key) {
        issues.push(`Row ${item.sourceRow}: resolve the conflicting parent reference.`);
      }
    }
  }

  for (const item of active) {
    const seen = new Set<string>();
    let cursor: ProjectImportItem | undefined = item;
    while (cursor?.parentKey) {
      if (seen.has(cursor.key)) {
        issues.push(`Row ${item.sourceRow}: the parent selection creates a cycle.`);
        break;
      }
      seen.add(cursor.key);
      cursor = byKey.get(cursor.parentKey);
    }
  }
  return [...new Set(issues)];
}

function resolveExplicitParents(
  items: ProjectImportItem[],
  mappings: ProjectImportMappings,
  sheet: ProjectImportSheet,
  headerIndex: number,
) {
  const rowsByNumber = new Map(
    sheet.rows
      .slice(headerIndex + 1)
      .map((values, index) => [headerIndex + index + 2, values] as const),
  );
  for (const item of items) {
    const values = rowsByNumber.get(item.sourceRow);
    if (!values) continue;
    const parentReference = cellText(values, mappings.parent).trim();
    const sourceId = cellText(values, mappings.id).trim();
    if (sourceId && items.filter((candidate) => candidate.sourceId === sourceId).length > 1) {
      item.errors.push(`Identifier "${sourceId}" is used more than once.`);
    }
    if (!parentReference) continue;
    const candidates = items.filter(
      (candidate) =>
        candidate.key !== item.key &&
        (candidate.sourceId === parentReference ||
          normalizeLabel(candidate.title) === normalizeLabel(parentReference)) &&
        isValidParent(item.kind, candidate.kind),
    );
    if (candidates.length === 1) {
      item.parentKey = candidates[0]?.key ?? null;
    } else if (candidates.length > 1) {
      item.errors.push(`Parent "${parentReference}" is ambiguous; select the correct parent.`);
    } else {
      item.errors.push(`Parent "${parentReference}" was not found; select the correct parent.`);
    }
  }
}

function reportDuplicates(items: ProjectImportItem[]) {
  const seen = new Map<string, ProjectImportItem>();
  for (const item of items) {
    const key = `${item.kind}\u0000${item.parentKey ?? ""}\u0000${normalizeLabel(item.title)}`;
    const previous = seen.get(key);
    if (previous) {
      const message = `Potential duplicate of row ${previous.sourceRow}; exclude or rename one entry.`;
      previous.errors.push(
        `Potential duplicate of row ${item.sourceRow}; exclude or rename one entry.`,
      );
      item.errors.push(message);
    } else {
      seen.set(key, item);
    }
  }
}

function isValidParent(kind: ProjectImportKind, parentKind: ProjectImportKind) {
  if (kind === "main_goal") return parentKind === "subproject";
  if (kind === "goal") return parentKind === "main_goal" || parentKind === "subproject";
  if (kind === "objective") return parentKind === "main_goal" || parentKind === "goal";
  return false;
}

function importKind(value: string): ProjectImportKind | null {
  const level = normalizeLabel(value);
  if (["subproject", "sub project", "sous projet", "phase"].includes(level)) return "subproject";
  if (["main goal", "parent goal", "objectif principal", "but principal"].includes(level)) {
    return "main_goal";
  }
  if (["goal", "but", "objectif"].includes(level)) return "goal";
  if (["objective", "task", "action", "tache", "sous objectif"].includes(level)) {
    return "objective";
  }
  return null;
}

function hasExcelSignature(buffer: ArrayBuffer, extension: string): boolean {
  const bytes = new Uint8Array(buffer);
  if (extension === "xlsx") {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      [0x03, 0x05, 0x07].includes(bytes[2] ?? -1) &&
      [0x04, 0x06, 0x08].includes(bytes[3] ?? -1)
    );
  }
  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  );
}

function inferredKind(indentation: number): ProjectImportKind {
  if (indentation <= 0) return "subproject";
  if (indentation === 1) return "main_goal";
  if (indentation === 2) return "goal";
  return "objective";
}

function rowIndentation(sheet: XLSX.WorkSheet, rowIndex: number, row: unknown[]) {
  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
  const actualRow = (range?.s.r ?? 0) + rowIndex;
  const styleIndent = row.reduce<number>((maximum, _value, column) => {
    const cell = sheet[XLSX.utils.encode_cell({ r: actualRow, c: column })];
    const indent = Number(cell?.s?.alignment?.indent ?? 0);
    return Number.isFinite(indent) ? Math.max(maximum, indent) : maximum;
  }, 0);
  const textIndent = row.reduce<number>((maximum, value) => {
    const leading = /^[\t ]+/.exec(stringValue(value))?.[0].length ?? 0;
    return Math.max(maximum, Math.floor(leading / 2));
  }, 0);
  return Math.max(styleIndent, textIndent);
}

function findHeaderRow(rows: unknown[][]) {
  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const score = headerScore(rows[index] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestScore >= 1 ? bestIndex : -1;
}

function scoreHeaderRows(rows: unknown[][]) {
  return Math.max(0, ...rows.slice(0, 30).map(headerScore));
}

function headerScore(row: unknown[]) {
  const labels = new Set(row.map((value) => normalizeLabel(stringValue(value))));
  return IMPORT_FIELDS.filter((field) =>
    FIELD_ALIASES[field].some((alias) => labels.has(normalizeLabel(alias))),
  ).length;
}

function normalizeLabel(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stringValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return "";
  return String(value);
}

function valueAt(values: unknown[], index: number | null) {
  return index === null ? "" : (values[index] ?? "");
}

function cellText(values: unknown[], index: number | null) {
  return stringValue(valueAt(values, index));
}

function normalizeDate(value: unknown, item: ProjectImportItem) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    }
  }
  const text = stringValue(value).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) {
    const normalized = `${iso[1]}-${iso[2]?.padStart(2, "0")}-${iso[3]?.padStart(2, "0")}`;
    if (isValidDate(normalized)) return normalized;
  }
  const dayFirst = /^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/.exec(text);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const year = Number(dayFirst[3]);
    if (day > 12 && month > 0 && month <= 12) {
      const normalized = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (isValidDate(normalized)) return normalized;
    }
    if (month > 12 && day > 0 && day <= 12) {
      const normalized = `${year}-${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}`;
      if (isValidDate(normalized)) return normalized;
    }
    if (day > 0 && day <= 12 && month > 0 && month <= 12) {
      item.warnings.push(`Date "${text}" is ambiguous; enter it again in YYYY-MM-DD format.`);
      return "";
    }
  }
  item.warnings.push(`Could not reliably read date "${text}".`);
  return "";
}

function isValidDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === (month ?? 1) - 1 &&
    date.getUTCDate() === day
  );
}

function findFormulaWarnings(sheet: XLSX.WorkSheet) {
  const warnings: string[] = [];
  if (!sheet["!ref"]) return warnings;
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell?.f && (cell.v === null || cell.v === undefined || cell.v === "")) {
        warnings.push(
          `Formula at ${XLSX.utils.encode_cell({ r: row, c: column })} has no cached value and will be left blank.`,
        );
      }
    }
  }
  return warnings;
}

function columnLabel(index: number) {
  let label = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }
  return label;
}
