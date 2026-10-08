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

function ensureSpace(doc: jsPDF, y: number, margin: number, pageHeight: number) {
  if (y > pageHeight - margin - 24) {
    doc.addPage();
    return margin;
  }

  return y;
}

export function downloadProjectReport(project: Project, goals: Goal[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addText = (
    text: string,
    options: { bold?: boolean; size?: number; color?: [number, number, number] } = {},
  ) => {
    const { bold = false, size = 11, color = [18, 18, 18] } = options;
    const wrapped = doc.splitTextToSize(text, contentWidth);

    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);

    for (const line of wrapped) {
      y = ensureSpace(doc, y, margin, pageHeight);
      doc.text(line, margin, y);
      y += size * 1.4;
    }
  };

  const addSection = (header: string, lines: string[]) => {
    addText(header, { bold: true, size: 14, color: [15, 23, 42] });
    y += 8;

    for (const line of lines) {
      addText(line, { size: 10, color: [31, 41, 55] });
    }

    y += 12;
  };

  addText("NEXORA", { bold: true, size: 26, color: [15, 23, 42] });
  y += 8;
  addText(`Project: ${project.name}`, { bold: true, size: 18, color: [15, 23, 42] });
  y += 10;
  addText("Project Report", { size: 10, color: [100, 116, 139] });
  y += 18;

  const projectLines = [
    `Name: ${project.name}`,
    `Description: ${project.description || "No description provided"}`,
    `Status: ${project.status === "on_hold" ? "Paused" : project.status}`,
    `Progress: ${project.progress ?? 0}%`,
    `Start date: ${formatDate(project.start_date)}`,
    `Deadline: ${formatDate(project.deadline)}`,
    `Created: ${formatDate(project.created_at)}`,
  ];
  addSection("Project Information", projectLines);

  addSection("Project Goals", []);

  if (goals.length === 0) {
    addText("No goals are currently associated with this project.", {
      size: 11,
      color: [71, 85, 105],
    });
  } else {
    const orderedGoals = sortGoalsChronologically(goals);
    orderedGoals.forEach((goal, index) => {
      const goalNumber = `${String(index + 1).padStart(2, "0")} — ${goal.title || "Untitled goal"}`;
      addText(goalNumber, { bold: true, size: 12, color: [15, 23, 42] });

      const goalLines = [
        `Target: ${goal.description || "No description provided"}`,
        `Due: ${formatDate(goal.target_date)}`,
        `Status: ${goal.status}`,
        `Progress: ${goal.progress ?? 0}%`,
      ];

      for (const line of goalLines) {
        addText(line, { size: 10, color: [31, 41, 55] });
      }

      y += 10;
    });
  }

  const filename = `${sanitizeProjectFilename(project.name)}.pdf`;
  doc.save(filename);
}
