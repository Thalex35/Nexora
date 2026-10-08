import { jsPDF } from "jspdf";

import type { Goal, Project } from "@/lib/nexora-data";
import { sortGoalsChronologically } from "@/lib/project-goals";

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

export function downloadProjectReport(project: Project, goals: Goal[]) {
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

  addSection("Project Goals", []);

  if (goals.length === 0) {
    addText("No goals are currently associated with this project.", {
      size: 10,
      color: [71, 85, 105],
    });
  } else {
    const orderedGoals = sortGoalsChronologically(goals);
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

  const filename = `${sanitizeProjectFilename(projectName)}.pdf`;
  doc.save(filename);
}
