import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, LoaderCircle, Upload, X } from "lucide-react";
import { toast } from "sonner";

import {
  buildProjectImportPreview,
  detectProjectImportMappings,
  PROJECT_IMPORT_FIELDS,
  readProjectWorkbook,
  suggestProjectImportSheet,
  validateProjectImportItems,
  projectImportHeaderRow,
  type ProjectImportField,
  type ProjectImportItem,
  type ProjectImportKind,
  type ProjectImportMappings,
  type ProjectImportSheet,
  type ProjectImportWorkbook,
} from "@/lib/project-structure-import";
import {
  useImportProjectStructure,
  type Goal,
  type Project,
  type ProjectSubproject,
} from "@/lib/nexora-data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PROJECT_PARENT = "__project__";

export function ProjectStructureImportDialog({
  open,
  onOpenChange,
  project,
  goals,
  subprojects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  goals: Goal[];
  subprojects: ProjectSubproject[];
}) {
  const importStructure = useImportProjectStructure();
  const inputRef = useRef<HTMLInputElement>(null);
  const [workbook, setWorkbook] = useState<ProjectImportWorkbook | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [mappings, setMappings] = useState<ProjectImportMappings | null>(null);
  const [items, setItems] = useState<ProjectImportItem[]>([]);
  const [unparsedRows, setUnparsedRows] = useState<number[]>([]);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [fileError, setFileError] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const selectedSheet = workbook?.sheets.find((sheet) => sheet.name === selectedSheetName);
  const previewItems = useMemo(
    () => withExistingConflicts(items, project.id, goals, subprojects),
    [goals, items, project.id, subprojects],
  );
  const excludedCount = previewItems.filter((item) => item.excluded).length;
  const validationIssues = [
    ...validateProjectImportItems(previewItems),
    ...previewItems
      .filter((item) => !item.excluded && !isSupportedStatus(item.kind, item.status))
      .map((item) => `Row ${item.sourceRow}: choose a supported status.`),
    ...previewItems
      .filter(
        (item) =>
          !item.excluded &&
          (item.kind === "subproject" || item.kind === "objective") &&
          item.priority.trim() !== "" &&
          !supportedPriority(item.priority),
      )
      .map((item) => `Row ${item.sourceRow}: choose low, medium, or high priority.`),
  ];
  const activeCounts = {
    subprojects: previewItems.filter((item) => !item.excluded && item.kind === "subproject").length,
    mainGoals: previewItems.filter((item) => !item.excluded && item.kind === "main_goal").length,
    goals: previewItems.filter((item) => !item.excluded && item.kind === "goal").length,
    objectives: previewItems.filter((item) => !item.excluded && item.kind === "objective").length,
  };

  async function selectFile(file: File | undefined) {
    if (!file) return;
    setFileError("");
    setConfirmError("");
    setWorkbook(null);
    setItems([]);
    setMappings(null);
    setIsParsing(true);
    setSelectedFile(file);
    try {
      const parsed = await readProjectWorkbook(file);
      const preferredName = suggestProjectImportSheet(parsed);
      const firstSheet = parsed.sheets.find((sheet) => sheet.name === preferredName);
      if (!firstSheet) throw new Error("This workbook does not contain a readable worksheet.");
      setWorkbook(parsed);
      setSelectedSheetName(firstSheet.name);
      setMappings(detectProjectImportMappings(firstSheet));
      updatePreview(firstSheet, detectProjectImportMappings(firstSheet));
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Couldn't read this workbook.");
    } finally {
      setIsParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function updatePreview(sheet: ProjectImportSheet, nextMappings: ProjectImportMappings) {
    const nextPreview = buildProjectImportPreview(sheet, project.name, nextMappings);
    setItems(nextPreview.items);
    setUnparsedRows(nextPreview.unparsedRows);
    setPreviewWarnings(nextPreview.warnings);
    setPreviewErrors(nextPreview.errors);
    setConfirmError("");
  }

  function changeSheet(name: string) {
    const nextSheet = workbook?.sheets.find((sheet) => sheet.name === name);
    if (!nextSheet) return;
    const nextMappings = detectProjectImportMappings(nextSheet);
    setSelectedSheetName(name);
    setMappings(nextMappings);
    updatePreview(nextSheet, nextMappings);
  }

  function changeMapping(field: ProjectImportField, rawIndex: string) {
    if (!selectedSheet || !mappings) return;
    const nextMappings = { ...mappings, [field]: rawIndex === "" ? null : Number(rawIndex) };
    setMappings(nextMappings);
    updatePreview(selectedSheet, nextMappings);
  }

  function updateItem(key: string, values: Partial<ProjectImportItem>) {
    setItems((current) => {
      const updated = current.map((item) => {
        if (item.key !== key) return item;
        const parent =
          values.kind !== undefined && item.parentKey
            ? current.find((candidate) => candidate.key === item.parentKey)
            : undefined;
        const invalidParent =
          values.kind !== undefined && parent && !validParent(values.kind, parent.kind);
        const errors = item.errors.filter((error) => {
          if (
            values.kind !== undefined &&
            (error === "Choose the item's hierarchy level before importing." ||
              error.startsWith("Parent ") ||
              error.startsWith("Choose a goal parent"))
          ) {
            return false;
          }
          if (
            values.parentKey !== undefined &&
            (error.startsWith("Parent ") || error.startsWith("Choose a goal parent"))
          ) {
            return false;
          }
          if (
            values.title !== undefined &&
            (error === "A name is required." || error.startsWith("Potential duplicate of row"))
          ) {
            return false;
          }
          return true;
        });
        return {
          ...item,
          ...values,
          ...(values.kind !== undefined
            ? {
                needsKindReview: false,
                ...(invalidParent ? { parentKey: null, parentReference: "" } : {}),
              }
            : {}),
          ...(values.parentKey !== undefined ? { parentReference: "" } : {}),
          errors,
          warnings:
            values.kind !== undefined
              ? item.warnings.filter(
                  (warning) => !warning.startsWith("The level was inferred from indentation"),
                )
              : item.warnings,
        };
      });
      return refreshDuplicateErrors(updated);
    });
    setConfirmError("");
  }

  function removeFile() {
    setWorkbook(null);
    setSelectedFile(null);
    setSelectedSheetName("");
    setMappings(null);
    setItems([]);
    setUnparsedRows([]);
    setPreviewWarnings([]);
    setPreviewErrors([]);
    setFileError("");
    setConfirmError("");
  }

  function resetDialog() {
    setWorkbook(null);
    setSelectedFile(null);
    setSelectedSheetName("");
    setMappings(null);
    setItems([]);
    setUnparsedRows([]);
    setPreviewWarnings([]);
    setPreviewErrors([]);
    setFileError("");
    setConfirmError("");
    setIsParsing(false);
    setIsDragging(false);
    onOpenChange(false);
  }

  async function confirmImport() {
    setConfirmError("");
    const issues = [...previewErrors, ...validationIssues];
    if (issues.length > 0) {
      setConfirmError(issues[0] ?? "Resolve the preview issues before importing.");
      return;
    }
    const includedItems = previewItems.filter((item) => !item.excluded);
    if (includedItems.length === 0) {
      setConfirmError("Select at least one item to import.");
      return;
    }
    if (includedItems.length > 1000) {
      setConfirmError("An import cannot contain more than 1000 items.");
      return;
    }
    if (!globalThis.crypto?.randomUUID) {
      setConfirmError("This browser does not support secure IDs required for importing.");
      return;
    }

    const ids = new Map(includedItems.map((item) => [item.key, globalThis.crypto.randomUUID()]));
    const itemByKey = new Map(includedItems.map((item) => [item.key, item]));
    const parentOf = (item: ProjectImportItem) =>
      item.parentKey ? itemByKey.get(item.parentKey) : undefined;
    const subprojectOf = (item: ProjectImportItem): ProjectImportItem | undefined => {
      let parent = parentOf(item);
      while (parent && parent.kind !== "subproject") parent = parentOf(parent);
      return parent;
    };
    const rpcInput = {
      projectId: project.id,
      subprojects: includedItems
        .filter((item) => item.kind === "subproject")
        .map((item) => ({
          id: ids.get(item.key) ?? "",
          title: item.title.trim(),
          description: item.description.trim() || null,
          objective: null,
          start_date: item.startDate || null,
          deadline: item.dueDate || null,
          status: projectStatus(item.status),
          priority: taskPriority(item.priority),
        })),
      goals: includedItems
        .filter((item) => item.kind === "main_goal" || item.kind === "goal")
        .map((item) => {
          const parent = parentOf(item);
          return {
            id: ids.get(item.key) ?? "",
            subproject_id: ids.get(subprojectOf(item)?.key ?? "") ?? null,
            parent_goal_id:
              parent && parent.kind !== "subproject" ? (ids.get(parent.key) ?? null) : null,
            title: item.title.trim(),
            description: item.description.trim() || null,
            status: goalStatus(item.status),
            target_date: item.dueDate || null,
          };
        }),
      tasks: includedItems
        .filter((item) => item.kind === "objective")
        .map((item) => ({
          id: ids.get(item.key) ?? "",
          goal_id: ids.get(item.parentKey ?? "") ?? "",
          title: item.title.trim(),
          description: item.description.trim() || null,
          status: taskStatus(item.status),
          priority: taskPriority(item.priority),
          due_date: item.dueDate || null,
        })),
    };

    try {
      const result = await importStructure.mutateAsync(rpcInput);
      toast.success(
        `Imported ${result.subprojects} subprojects, ${result.goals} goals, and ${result.objectives} objectives.`,
      );
      resetDialog();
    } catch (error) {
      setConfirmError(
        error instanceof Error ? error.message : "The import failed. No items were saved.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : resetDialog())}
    >
      <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import project structure</DialogTitle>
          <DialogDescription>
            Upload an Excel workbook, review the detected hierarchy, then confirm to add it to{" "}
            <span className="font-medium text-foreground">{project.name}</span>.
          </DialogDescription>
        </DialogHeader>

        {!workbook && (
          <section
            className={`rounded-xl border border-dashed p-6 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void selectFile(event.dataTransfer.files[0]);
            }}
          >
            {isParsing ? (
              <LoaderCircle
                className="mx-auto size-8 animate-spin text-primary"
                aria-hidden="true"
              />
            ) : (
              <FileSpreadsheet className="mx-auto size-8 text-primary" aria-hidden="true" />
            )}
            <p className="mt-3 font-medium">
              {isParsing ? "Reading workbook…" : "Drop an Excel workbook here"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Supports .xls and .xlsx files up to 10 MB. Formulas are not run.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => void selectFile(event.currentTarget.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              disabled={isParsing}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-2 size-4" aria-hidden="true" />
              Choose file
            </Button>
            {fileError && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {fileError}
              </p>
            )}
          </section>
        )}

        {workbook && mappings && selectedSheet && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileSpreadsheet className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate text-sm font-medium">{selectedFile?.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile?.size ?? 0)}
                </span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={removeFile}>
                <X className="mr-1 size-4" aria-hidden="true" />
                Remove file
              </Button>
            </div>

            {workbook.sheets.length > 1 && (
              <div className="max-w-sm space-y-2">
                <Label htmlFor="project-import-sheet">Worksheet</Label>
                <select
                  id="project-import-sheet"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedSheetName}
                  onChange={(event) => changeSheet(event.target.value)}
                >
                  {workbook.sheets.map((sheet) => (
                    <option key={sheet.name} value={sheet.name}>
                      {sheet.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <section className="space-y-3">
              <div>
                <h3 className="font-semibold">Column mapping</h3>
                <p className="text-sm text-muted-foreground">
                  Review or correct which spreadsheet columns represent each field.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PROJECT_IMPORT_FIELDS.map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`project-import-map-${key}`} className="text-xs">
                      {label}
                    </Label>
                    <select
                      id={`project-import-map-${key}`}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={mappings[key] ?? ""}
                      onChange={(event) => changeMapping(key, event.target.value)}
                    >
                      <option value="">Not mapped</option>
                      {selectedSheet.columns.map((column) => (
                        <option key={column.index} value={column.index}>
                          {column.label}: {headerText(selectedSheet, column.index)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {unsupportedColumns(selectedSheet, mappings).length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Unmapped columns: {unsupportedColumns(selectedSheet, mappings).join(", ")}
                </p>
              )}
            </section>

            <section className="space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Import preview</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedSheet.name} · nothing is saved until you confirm.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Count label="Subprojects" count={activeCounts.subprojects} />
                  <Count label="Main goals" count={activeCounts.mainGoals} />
                  <Count label="Goals" count={activeCounts.goals} />
                  <Count label="Objectives" count={activeCounts.objectives} />
                </div>
              </div>

              {previewErrors.length > 0 && (
                <ul className="list-inside list-disc rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {previewErrors.map((warning, index) => (
                    <li key={`${index}-${warning}`}>{warning}</li>
                  ))}
                </ul>
              )}
              {previewWarnings.length > 0 && (
                <ul className="list-inside list-disc rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  {previewWarnings.map((warning, index) => (
                    <li key={`${index}-${warning}`}>{warning}</li>
                  ))}
                </ul>
              )}
              {unparsedRows.length > 0 && (
                <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                  Rows not interpreted: {unparsedRows.join(", ")}. They were not discarded silently.
                </p>
              )}

              {previewItems.length === 0 ? (
                <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                  No project items were detected. Adjust the worksheet or column mappings above.
                </p>
              ) : (
                <div className="max-h-[42dvh] space-y-3 overflow-y-auto pr-1">
                  {previewItems.map((item) => (
                    <ImportItemEditor
                      key={item.key}
                      item={item}
                      candidates={previewItems}
                      onChange={(values) => updateItem(item.key, values)}
                    />
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {excludedCount} excluded · imported items belong to the current project.
              </p>
            </section>

            {confirmError && (
              <p className="text-sm text-destructive" role="alert">
                {confirmError}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={resetDialog}>
            Cancel
          </Button>
          {workbook && (
            <Button
              type="button"
              onClick={() => void confirmImport()}
              disabled={importStructure.isPending || isParsing || previewItems.length === 0}
            >
              {importStructure.isPending ? (
                <>
                  <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  Importing…
                </>
              ) : (
                "Confirm import"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportItemEditor({
  item,
  candidates,
  onChange,
}: {
  item: ProjectImportItem;
  candidates: ProjectImportItem[];
  onChange: (values: Partial<ProjectImportItem>) => void;
}) {
  const parents = candidates.filter(
    (candidate) =>
      !candidate.excluded && candidate.key !== item.key && validParent(item.kind, candidate.kind),
  );
  const parentIsValid = !item.parentKey || parents.some((parent) => parent.key === item.parentKey);
  return (
    <article
      className={`space-y-3 rounded-lg border p-3 ${
        item.excluded ? "opacity-60" : item.errors.length > 0 ? "border-destructive/50" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            aria-label={`Item type for row ${item.sourceRow}`}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
            value={item.kind}
            disabled={item.excluded}
            onChange={(event) => onChange({ kind: event.target.value as ProjectImportKind })}
          >
            {(["subproject", "main_goal", "goal", "objective"] as const).map((kind) => (
              <option key={kind} value={kind}>
                {kindLabel(kind)}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">Row {item.sourceRow}</span>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={item.excluded}
            onChange={(event) => onChange({ excluded: event.target.checked })}
          />
          Exclude
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`import-name-${item.key}`} className="text-xs">
            Name
          </Label>
          <Input
            id={`import-name-${item.key}`}
            value={item.title}
            disabled={item.excluded}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </div>
        {item.kind !== "subproject" && (
          <div className="space-y-1">
            <Label htmlFor={`import-parent-${item.key}`} className="text-xs">
              Parent
            </Label>
            <select
              id={`import-parent-${item.key}`}
              className={`h-9 w-full rounded-md border bg-background px-3 text-sm ${
                !parentIsValid ? "border-destructive" : "border-input"
              }`}
              value={item.parentKey ?? (item.kind === "objective" ? "" : PROJECT_PARENT)}
              disabled={item.excluded}
              onChange={(event) =>
                onChange({
                  parentKey:
                    event.target.value === PROJECT_PARENT ? null : event.target.value || null,
                })
              }
            >
              {item.kind === "objective" ? (
                <option value="">Choose a goal…</option>
              ) : (
                <option value={PROJECT_PARENT}>Current project</option>
              )}
              {parents.map((parent) => (
                <option key={parent.key} value={parent.key}>
                  {kindLabel(parent.kind)} · {parent.title || `Row ${parent.sourceRow}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`import-description-${item.key}`} className="text-xs">
          Description
        </Label>
        <Textarea
          id={`import-description-${item.key}`}
          rows={2}
          value={item.description}
          disabled={item.excluded}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor={`import-status-${item.key}`} className="text-xs">
            Status
          </Label>
          <select
            id={`import-status-${item.key}`}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={statusChoice(item.kind, item.status)}
            disabled={item.excluded}
            onChange={(event) =>
              onChange({
                status: event.target.value === "__unknown__" ? item.status : event.target.value,
              })
            }
          >
            <option value="">Default: {defaultStatus(item.kind)}</option>
            {!isSupportedStatus(item.kind, item.status) && item.status && (
              <option value="__unknown__">Unrecognized: {item.status}</option>
            )}
            {statusChoices(item.kind).map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`import-priority-${item.key}`} className="text-xs">
            Priority
          </Label>
          <select
            id={`import-priority-${item.key}`}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={priorityChoice(item.priority)}
            disabled={item.excluded}
            onChange={(event) =>
              onChange({
                priority: event.target.value === "__unknown__" ? item.priority : event.target.value,
              })
            }
          >
            <option value="">Default: medium</option>
            {!supportedPriority(item.priority) && item.priority && (
              <option value="__unknown__">Unrecognized: {item.priority}</option>
            )}
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`import-due-${item.key}`} className="text-xs">
            Start / due date
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              id={`import-start-${item.key}`}
              type="date"
              aria-label={`Start date for ${item.title || `row ${item.sourceRow}`}`}
              value={item.startDate}
              disabled={item.excluded}
              onChange={(event) => onChange({ startDate: event.target.value })}
              title="Start date"
            />
            <Input
              id={`import-due-${item.key}`}
              type="date"
              aria-label={`Due date for ${item.title || `row ${item.sourceRow}`}`}
              value={item.dueDate}
              disabled={item.excluded}
              onChange={(event) => onChange({ dueDate: event.target.value })}
              title="Due date"
            />
          </div>
        </div>
      </div>
      {item.errors.length > 0 && (
        <ul className="list-inside list-disc text-xs text-destructive">
          {item.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {item.warnings.length > 0 && (
        <ul className="list-inside list-disc text-xs text-amber-700 dark:text-amber-200">
          {item.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function withExistingConflicts(
  items: ProjectImportItem[],
  projectId: string,
  existingGoals: Goal[],
  existingSubprojects: ProjectSubproject[],
) {
  const byKey = new Map(items.map((item) => [item.key, item]));
  return items.map((item) => {
    if (item.excluded) return item;
    const parent = item.parentKey ? byKey.get(item.parentKey) : undefined;
    let existing = false;
    if (item.kind === "subproject") {
      existing = existingSubprojects.some(
        (subproject) =>
          subproject.project_id === projectId && sameTitle(subproject.title, item.title),
      );
    } else if (item.kind === "main_goal" || item.kind === "goal") {
      const importedGoalParent =
        item.kind === "goal" && parent && parent.kind !== "subproject" ? parent : undefined;
      if (!importedGoalParent && (!parent || parent.kind === "subproject")) {
        const existingSubprojectId =
          parent?.kind === "subproject"
            ? (existingSubprojects.find((subproject) => sameTitle(subproject.title, parent.title))
                ?.id ?? null)
            : null;
        existing = existingGoals.some(
          (goal) =>
            goal.project_id === projectId &&
            goal.parent_goal_id === null &&
            goal.subproject_id === existingSubprojectId &&
            sameTitle(goal.title, item.title),
        );
      }
    }
    if (!existing) return item;
    const conflict = "An item with this name already exists under the selected project parent.";
    return {
      ...item,
      errors: item.errors.includes(conflict) ? item.errors : [...item.errors, conflict],
    };
  });
}

function refreshDuplicateErrors(items: ProjectImportItem[]) {
  const cleaned = items.map((item) => ({
    ...item,
    errors: item.errors.filter((error) => !error.startsWith("Potential duplicate of row")),
  }));
  const seen = new Map<string, ProjectImportItem>();
  for (const item of cleaned) {
    if (item.excluded || !item.title.trim()) continue;
    const key = `${item.kind}\u0000${item.parentKey ?? ""}\u0000${normalize(item.title)}`;
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, item);
      continue;
    }
    previous.errors.push(
      `Potential duplicate of row ${item.sourceRow}; exclude or rename one entry.`,
    );
    item.errors.push(
      `Potential duplicate of row ${previous.sourceRow}; exclude or rename one entry.`,
    );
  }
  return cleaned;
}

function validParent(kind: ProjectImportKind, parentKind: ProjectImportKind) {
  if (kind === "main_goal") return parentKind === "subproject";
  if (kind === "goal") return parentKind === "main_goal" || parentKind === "subproject";
  if (kind === "objective") return parentKind === "main_goal" || parentKind === "goal";
  return false;
}

function projectStatus(
  value: string,
): "planning" | "active" | "on_hold" | "completed" | "archived" {
  const status = normalize(value);
  if (["active", "in progress", "en cours"].includes(status)) return "active";
  if (["paused", "on hold", "on_hold", "en pause"].includes(status)) return "on_hold";
  if (["completed", "complete", "done", "termine", "terminee"].includes(status)) {
    return "completed";
  }
  if (["archived", "archive", "archivee"].includes(status)) return "archived";
  return "planning";
}

function goalStatus(value: string): "active" | "paused" | "completed" | "archived" {
  const status = normalize(value);
  if (["active", "in progress", "en cours"].includes(status)) return "active";
  if (["paused", "on hold", "on_hold", "en pause"].includes(status)) return "paused";
  if (["completed", "complete", "done", "termine", "terminee"].includes(status)) {
    return "completed";
  }
  if (["archived", "archive", "archivee"].includes(status)) return "archived";
  return "active";
}

function taskStatus(value: string): "todo" | "in_progress" | "done" {
  const status = normalize(value);
  if (["done", "complete", "completed", "termine", "terminee"].includes(status)) return "done";
  if (["in progress", "in_progress", "doing", "en cours"].includes(status)) return "in_progress";
  return "todo";
}

function taskPriority(value: string): "low" | "medium" | "high" {
  const priority = normalize(value);
  if (["low", "basse", "faible"].includes(priority)) return "low";
  if (["high", "haute", "elevee"].includes(priority)) return "high";
  return "medium";
}

function isSupportedStatus(kind: ProjectImportKind, value: string) {
  const status = normalize(value);
  if (!status) return true;
  if (kind === "subproject") {
    return [
      "planning",
      "planned",
      "active",
      "in progress",
      "en cours",
      "paused",
      "on hold",
      "completed",
      "complete",
      "done",
      "termine",
      "terminee",
      "archived",
      "archive",
      "archivee",
    ].includes(status);
  }
  if (kind === "objective") {
    return [
      "todo",
      "to do",
      "not started",
      "a faire",
      "a realiser",
      "in progress",
      "in_progress",
      "doing",
      "en cours",
      "done",
      "complete",
      "completed",
      "termine",
      "terminee",
    ].includes(status);
  }
  return [
    "active",
    "in progress",
    "en cours",
    "paused",
    "on hold",
    "on_hold",
    "en pause",
    "completed",
    "complete",
    "done",
    "termine",
    "terminee",
    "archived",
    "archive",
    "archivee",
  ].includes(status);
}

function statusChoices(kind: ProjectImportKind) {
  if (kind === "subproject") {
    return [
      { value: "planning", label: "Planning" },
      { value: "active", label: "Active" },
      { value: "on_hold", label: "Paused" },
      { value: "completed", label: "Completed" },
      { value: "archived", label: "Archived" },
    ];
  }
  if (kind === "objective") {
    return [
      { value: "todo", label: "To do" },
      { value: "in_progress", label: "In progress" },
      { value: "done", label: "Done" },
    ];
  }
  return [
    { value: "active", label: "Active" },
    { value: "paused", label: "Paused" },
    { value: "completed", label: "Completed" },
    { value: "archived", label: "Archived" },
  ];
}

function statusChoice(kind: ProjectImportKind, value: string) {
  if (!value.trim()) return "";
  if (!isSupportedStatus(kind, value)) return "__unknown__";
  if (kind === "subproject") return projectStatus(value);
  if (kind === "objective") return taskStatus(value);
  return goalStatus(value);
}

function supportedPriority(value: string) {
  return [
    "low",
    "basse",
    "faible",
    "medium",
    "moyenne",
    "average",
    "normal",
    "high",
    "haute",
    "elevee",
  ].includes(normalize(value));
}

function priorityChoice(value: string) {
  if (!value.trim()) return "";
  if (!supportedPriority(value)) return "__unknown__";
  return taskPriority(value);
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
}

function sameTitle(left: string, right: string) {
  return normalize(left) === normalize(right);
}

function defaultStatus(kind: ProjectImportKind) {
  if (kind === "subproject") return "planning";
  if (kind === "objective") return "todo";
  return "active";
}

function kindLabel(kind: ProjectImportKind) {
  if (kind === "subproject") return "Subproject";
  if (kind === "main_goal") return "Main goal";
  if (kind === "goal") return "Goal";
  return "Objective";
}

function headerText(sheet: ProjectImportSheet, index: number) {
  const headerIndex = projectImportHeaderRow(sheet);
  const value = sheet.rows[headerIndex]?.[index];
  return value === null || value === undefined || String(value).trim() === ""
    ? "Column"
    : String(value);
}

function unsupportedColumns(sheet: ProjectImportSheet, mappings: ProjectImportMappings) {
  const used = new Set(Object.values(mappings).filter((index): index is number => index !== null));
  return sheet.columns
    .filter((column) => !used.has(column.index))
    .map((column) => `${column.label}: ${headerText(sheet, column.index)}`);
}

function formatFileSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function Count({ label, count }: { label: string; count: number }) {
  return (
    <span className="rounded-full bg-muted px-2.5 py-1">
      {label}: <strong>{count}</strong>
    </span>
  );
}
