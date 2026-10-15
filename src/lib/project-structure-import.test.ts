import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as XLSX from "@e965/xlsx";

import {
  buildProjectImportPreview,
  detectProjectImportMappings,
  readProjectWorkbook,
  suggestProjectImportSheet,
  validateProjectImportItems,
  type ProjectImportSheet,
} from "./project-structure-import.ts";

const importMigration = readFileSync(
  new URL("../../supabase/migrations/20261015110000_project_structure_import.sql", import.meta.url),
  "utf8",
);

function makeSheet(rows: unknown[][], name = "Plan"): ProjectImportSheet {
  const width = Math.max(0, ...rows.map((row) => row.length));
  return {
    name,
    columns: Array.from({ length: width }, (_, index) => ({
      index,
      label: String.fromCharCode(65 + index),
    })),
    rows,
    formulaWarnings: [],
  };
}

function workbookFile(name: string, rows: unknown[][], bookType: "xlsx" | "biff8") {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Structure");
  const bytes = XLSX.write(workbook, { type: "array", bookType });
  const type =
    bookType === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/vnd.ms-excel";
  return new File([bytes], name, { type });
}

test("detects reordered French and English headers and builds a nested table hierarchy", () => {
  const sheet = makeSheet([
    ["Description", "Objective", "Goal", "Main Goal", "Subproject Name", "Project"],
    [
      "Record the credited amount",
      "Store the actual USD received",
      "Track funding",
      "Financial visibility",
      "Business management",
      "Nexora",
    ],
  ]);
  const mappings = detectProjectImportMappings(sheet);
  const preview = buildProjectImportPreview(sheet, "Nexora", mappings);

  assert.equal(preview.errors.length, 0);
  assert.deepEqual(
    preview.items.map(({ kind, title }) => [kind, title]),
    [
      ["subproject", "Business management"],
      ["main_goal", "Financial visibility"],
      ["goal", "Track funding"],
      ["objective", "Store the actual USD received"],
    ],
  );
  const goal = preview.items.find((item) => item.kind === "goal");
  const objective = preview.items.find((item) => item.kind === "objective");
  assert.equal(goal?.parentKey, preview.items.find((item) => item.kind === "main_goal")?.key);
  assert.equal(objective?.parentKey, goal?.key);
  assert.equal(objective?.description, "Record the credited amount");
});

test("uses row type and explicit parent IDs when columns are reordered", () => {
  const sheet = makeSheet([
    ["Description", "Parent ID", "Identifier", "Name", "Level"],
    ["Phase description", "", "sp-1", "Planning", "Subproject"],
    ["Top outcome", "sp-1", "mg-1", "Visibility", "Main Goal"],
    ["Track income", "mg-1", "g-1", "Funding", "Goal"],
    ["Record deposits", "g-1", "o-1", "Credited amount", "Objective"],
  ]);
  const preview = buildProjectImportPreview(sheet, "Nexora");

  assert.equal(preview.items.length, 4);
  assert.equal(preview.items[1]?.parentKey, preview.items[0]?.key);
  assert.equal(preview.items[2]?.parentKey, preview.items[1]?.key);
  assert.equal(preview.items[3]?.parentKey, preview.items[2]?.key);
  assert.equal(preview.items[0]?.description, "Phase description");
  assert.deepEqual(validateProjectImportItems(preview.items), []);
});

test("reports missing fields, unknown rows, duplicate items, and ambiguous parents", () => {
  const sheet = makeSheet([
    ["Level", "Name", "Parent"],
    ["Main Goal", "Visibility", ""],
    ["Main Goal", "Visibility", ""],
    ["Goal", "Funding", "Visibility"],
    ["Not a known level", "Unparsed", ""],
  ]);
  const preview = buildProjectImportPreview(sheet, "Nexora");

  assert.equal(preview.items.length, 3);
  assert.ok(
    preview.items.some((item) =>
      item.errors.some((error) => error.includes("Potential duplicate")),
    ),
  );
  assert.ok(preview.items.some((item) => item.errors.some((error) => error.includes("ambiguous"))));
  assert.deepEqual(preview.unparsedRows, [5]);
});

test("keeps optional columns optional and flags objectives with no goal parent", () => {
  const sheet = makeSheet([
    ["Name", "Level"],
    ["Add an objective", "Objective"],
  ]);
  const preview = buildProjectImportPreview(sheet, "Nexora");

  assert.equal(preview.items[0]?.description, "");
  assert.ok(preview.items[0]?.errors.some((error) => error.includes("goal parent")));
  assert.ok(validateProjectImportItems(preview.items).length > 0);
});

test("reads both legacy XLS and XLSX workbooks and suggests the relevant sheet", async () => {
  for (const [extension, bookType] of [
    ["xlsx", "xlsx"],
    ["xls", "biff8"],
  ] as const) {
    const workbook = await readProjectWorkbook(
      workbookFile(
        `structure.${extension}`,
        [
          ["Level", "Name"],
          ["Subproject", "Roadmap"],
        ],
        bookType,
      ),
    );
    assert.equal(suggestProjectImportSheet(workbook), "Structure");
    assert.equal(workbook.sheets[0]?.rows.length, 2);
    assert.equal(buildProjectImportPreview(workbook.sheets[0]!, "Nexora").items.length, 1);
  }
});

test("rejects unsupported, empty, and corrupted workbook inputs with clear errors", async () => {
  await assert.rejects(
    () => readProjectWorkbook(new File(["not excel"], "structure.csv", { type: "text/csv" })),
    /Choose an Excel workbook/,
  );
  await assert.rejects(
    () => readProjectWorkbook(new File([], "empty.xlsx")),
    /selected workbook is empty/,
  );
  await assert.rejects(
    () => readProjectWorkbook(new File(["not excel"], "broken.xls")),
    /could not be read/,
  );
});

test("reports empty worksheets rather than importing an empty structure", () => {
  const preview = buildProjectImportPreview(makeSheet([]), "Nexora");
  assert.deepEqual(preview.items, []);
  assert.ok(preview.errors.some((error) => error.includes("header row")));
});

test("migration enforces same-parent ownership and imports all records atomically", () => {
  assert.match(importMigration, /ADD COLUMN parent_goal_id UUID/);
  assert.match(importMigration, /ADD COLUMN goal_id UUID REFERENCES public\.goals/);
  assert.match(importMigration, /Goal hierarchy cannot contain a cycle/);
  assert.match(importMigration, /same user, project, and subproject/);
  assert.match(importMigration, /SECURITY INVOKER/);
  assert.match(importMigration, /FOR UPDATE/);
  assert.match(importMigration, /RAISE EXCEPTION 'A goal with one of these names already exists/);
  assert.match(importMigration, /GRANT EXECUTE ON FUNCTION public\.import_project_structure/);
});
