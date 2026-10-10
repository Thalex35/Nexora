import { jsPDF } from "jspdf";

import type {
  Goal,
  Project,
  ProjectBudget,
  ProjectBudgetItem,
  ProjectSubproject,
} from "./nexora-data.ts";
import { calculateProjectBudgetSummary, formatBudgetAmount } from "./project-budget.ts";
import { sortGoalsChronologically } from "./project-goals.ts";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function sanitizeProjectFilename(name: string) {
  const safeName = String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return safeName || "project";
}

export type ProjectBudgetReport = {
  budget: ProjectBudget;
  items: ProjectBudgetItem[];
};

export type ProjectSubprojectReport = {
  subproject: ProjectSubproject;
  goals: Goal[];
};

export function createProjectReport(
  project: Project,
  goals: Goal[],
  budgetReport?: ProjectBudgetReport,
  subprojectReports: ProjectSubprojectReport[] = [],
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const bottom = pageHeight - margin;
  let y = margin;

  const addText = (
    text: string,
    options: { bold?: boolean; size?: number; color?: [number, number, number] } = {},
  ) => {
    const { bold = false, size = 10, color = [31, 41, 55] } = options;
    const lineHeight = size * 1.4;

    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);

    const wrappedLines = doc.splitTextToSize(text, contentWidth) as string[];
    for (const line of wrappedLines) {
      if (y + lineHeight > bottom) {
        doc.addPage();
        y = margin;
      }

      doc.text(line, margin, y);
      y += lineHeight;
    }
  };

  const addSection = (title: string, lines: string[]) => {
    if (y + 48 > bottom) {
      doc.addPage();
      y = margin;
    }

    addText(title, { bold: true, size: 14, color: [15, 23, 42] });
    y += 8;

    for (const line of lines) {
      addText(line);
    }

    y += 12;
  };

  const projectName = project.name || "Project";
  const exportDate = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date());

  addText("NEXORA", { bold: true, size: 26, color: [15, 23, 42] });
  y += 8;
  addText(`Project: ${projectName}`, { bold: true, size: 18, color: [15, 23, 42] });
  y += 10;
  addText("Project Report", { size: 10, color: [100, 116, 139] });
  addText("Owner / Editor: Theodore Louisjuste", { size: 10, color: [100, 116, 139] });
  addText(`Generated: ${exportDate}`, { size: 10, color: [100, 116, 139] });
  y += 18;

  addSection("Project Information", [
    `Name: ${projectName}`,
    `Description: ${project.description || "No description provided"}`,
    `Status: ${project.status === "on_hold" ? "Paused" : project.status}`,
    `Progress: ${project.progress ?? 0}%`,
    `Start date: ${formatDate(project.start_date)}`,
    `Deadline: ${formatDate(project.deadline)}`,
    `Created: ${formatDate(project.created_at)}`,
  ]);

  addSection("Subprojects", []);

  if (subprojectReports.length === 0) {
    addText("No subprojects have been added.", { size: 10, color: [71, 85, 105] });
  } else {
    subprojectReports.forEach(({ subproject, goals: subprojectGoals }, index) => {
      addSection(`${String(index + 1).padStart(2, "0")} — ${subproject.title}`, [
        `Description: ${subproject.description || "No description provided"}`,
        `Objective: ${subproject.objective || "Not set"}`,
        `Status: ${subproject.status === "on_hold" ? "Paused" : subproject.status}`,
        `Priority: ${subproject.priority}`,
        `Start date: ${formatDate(subproject.start_date)}`,
        `Deadline: ${formatDate(subproject.deadline)}`,
        `Notes: ${subproject.notes || "None"}`,
      ]);
      if (subprojectGoals.length === 0) {
        addText("No goals assigned to this subproject.", { size: 10, color: [71, 85, 105] });
        y += 8;
        return;
      }
      sortGoalsChronologically(subprojectGoals).forEach((goal) => {
        if (y + 42 > bottom) {
          doc.addPage();
          y = margin;
        }
        addText(goal.title || "Untitled goal", { bold: true, size: 12, color: [15, 23, 42] });
        addText(`Description: ${goal.description || "No description provided"}`);
        addText(`Due: ${formatDate(goal.target_date)} · Status: ${goal.status}`);
        addText(`Progress: ${goal.progress ?? 0}%`);
        y += 8;
      });
    });
  }

  const legacyGoals = goals.filter((goal) => !goal.subproject_id);
  addSection("Goals to organize", []);

  if (legacyGoals.length === 0) {
    addText("No legacy or unassigned project goals.", {
      size: 10,
      color: [71, 85, 105],
    });
  } else {
    const orderedGoals = sortGoalsChronologically(legacyGoals);
    orderedGoals.forEach((goal, index) => {
      const title = `${String(index + 1).padStart(2, "0")} — ${goal.title || "Untitled goal"}`;
      if (y + 42 > bottom) {
        doc.addPage();
        y = margin;
      }

      addText(title, { bold: true, size: 12, color: [15, 23, 42] });
      addText(`Target: ${goal.description || "No description provided"}`);
      addText(`Due: ${formatDate(goal.target_date)}`);
      addText(`Status: ${goal.status}`);
      addText(`Progress: ${goal.progress ?? 0}%`);
      y += 10;
    });
  }

  if (budgetReport) {
    const { budget, items } = budgetReport;
    const budgetSummary = calculateProjectBudgetSummary(
      budget.planned_amount,
      budget.available_funds,
      items,
    );
    addSection("Project Budget", [
      `Currency: ${budget.currency}`,
      `Planned budget: ${formatBudgetAmount(budget.planned_amount, budget.currency)}`,
      `Allocated across items: ${formatBudgetAmount(budgetSummary.allocated, budget.currency)}`,
      `Actual spending: ${formatBudgetAmount(budgetSummary.actual, budget.currency)}`,
      `Variance (actual vs allocated): ${formatBudgetAmount(budgetSummary.variance, budget.currency)}`,
      `Remaining: ${formatBudgetAmount(budgetSummary.remaining, budget.currency)}`,
      `Budget used: ${Math.round(budgetSummary.progressPercent)}%`,
      `Budget status: ${budgetSummary.overBudget ? "Over budget" : "Within plan"}`,
      `Available funds: ${
        budget.available_funds === null
          ? "Not set"
          : formatBudgetAmount(budget.available_funds, budget.currency)
      }`,
      `Available funds after spending: ${
        budgetSummary.availableFundsRemaining === null
          ? "Not set"
          : formatBudgetAmount(budgetSummary.availableFundsRemaining, budget.currency)
      }`,
    ]);

    for (const category of budgetSummary.categories) {
      addText(
        `${category.category} — planned: ${formatBudgetAmount(category.planned, budget.currency)} · actual: ${formatBudgetAmount(category.actual, budget.currency)} · variance: ${formatBudgetAmount(category.variance, budget.currency)}`,
        { size: 10, color: [71, 85, 105] },
      );
    }

    if (items.length === 0) {
      addText("No budget items have been added.", { size: 10, color: [71, 85, 105] });
    } else {
      items.forEach((item, index) => {
        if (y + 50 > bottom) {
          doc.addPage();
          y = margin;
        }
        addText(`${String(index + 1).padStart(2, "0")} — ${item.title}`, {
          bold: true,
          size: 12,
          color: [15, 23, 42],
        });
        addText(`Category: ${item.category}`);
        addText(
          `Planned: ${formatBudgetAmount(item.planned_amount, budget.currency)} · Actual: ${formatBudgetAmount(item.actual_amount, budget.currency)}`,
        );
        addText(`Target date: ${formatDate(item.target_date)}`);
        if (item.notes) addText(`Notes: ${item.notes}`);
        y += 10;
      });
    }
  }

  return doc;
}

export function downloadProjectReport(
  project: Project,
  goals: Goal[],
  budgetReport?: ProjectBudgetReport,
  subprojectReports: ProjectSubprojectReport[] = [],
) {
  const doc = createProjectReport(project, goals, budgetReport, subprojectReports);
  const filename = `${sanitizeProjectFilename(project.name || "Project")}.pdf`;
  doc.save(filename);
}
