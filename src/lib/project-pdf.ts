import { jsPDF } from "jspdf";

import type { Goal, Project } from "@/lib/nexora-data";
import { sortGoalsChronologically } from "@/lib/project-goals";

type PdfThemeColor = [number, number, number];

type PdfTheme = {
  headerBackground: PdfThemeColor;
  pageBackground: PdfThemeColor;
  panelBackground: PdfThemeColor;
  border: PdfThemeColor;
  heading: PdfThemeColor;
  body: PdfThemeColor;
  muted: PdfThemeColor;
  accent: PdfThemeColor;
  accentSoft: PdfThemeColor;
  success: PdfThemeColor;
  warning: PdfThemeColor;
  danger: PdfThemeColor;
  shadow: PdfThemeColor;
};

const pdfTheme: PdfTheme = {
  headerBackground: [9, 15, 20],
  pageBackground: [245, 247, 249],
  panelBackground: [255, 255, 255],
  border: [221, 228, 234],
  heading: [15, 23, 42],
  body: [51, 65, 85],
  muted: [100, 116, 139],
  accent: [45, 212, 191],
  accentSoft: [207, 250, 254],
  success: [16, 185, 129],
  warning: [245, 158, 11],
  danger: [239, 68, 68],
  shadow: [15, 23, 42],
};

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

function addPageHeaderFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(...pdfTheme.headerBackground);
  doc.rect(0, 0, pageWidth, 42, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("NEXORA", 48, 24);

  doc.setDrawColor(...pdfTheme.border);
  doc.line(48, pageHeight - 34, pageWidth - 48, pageHeight - 34);

  doc.setTextColor(...pdfTheme.muted);
  doc.setFontSize(8);
  doc.text("Project Report", 48, pageHeight - 18);
  doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 88, pageHeight - 18);
}

function addCard(doc: jsPDF, x: number, y: number, width: number, height: number, title: string) {
  doc.setFillColor(...pdfTheme.panelBackground);
  doc.setDrawColor(...pdfTheme.border);
  doc.roundedRect(x, y, width, height, 8, 8, "FD");

  doc.setFillColor(...pdfTheme.accentSoft);
  doc.roundedRect(x, y, 4, height, 2, 2, "F");

  doc.setTextColor(...pdfTheme.heading);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, x + 14, y + 18);

  return { x: x + 14, y: y + 30, width: width - 28, height: height - 38 };
}

function addDetailField(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  valueColor: [number, number, number] = pdfTheme.heading,
) {
  doc.setTextColor(...pdfTheme.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(label, x, y);

  doc.setTextColor(...valueColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const wrapped = doc.splitTextToSize(value, width);
  doc.text(wrapped[0] ?? "", x, y + 12);

  if (wrapped.length > 1) {
    for (let i = 1; i < wrapped.length; i += 1) {
      doc.text(wrapped[i] ?? "", x, y + 12 + i * 10);
    }
  }
}

function addProjectMeta(doc: jsPDF, project: Project, exportDate: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 48;
  const width = pageWidth - left * 2;
  const cardHeight = 92;
  const cardY = 132;

  doc.setFillColor(...pdfTheme.panelBackground);
  doc.setDrawColor(...pdfTheme.border);
  doc.roundedRect(left, cardY, width, cardHeight, 12, 12, "FD");

  const badgeX = left + 24;
  const badgeY = cardY + 22;
  doc.setFillColor(...pdfTheme.accentSoft);
  doc.roundedRect(badgeX, badgeY, 92, 22, 11, 11, "F");
  doc.setTextColor(...pdfTheme.heading);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PROJECT REPORT", badgeX + 12, badgeY + 15);

  doc.setTextColor(...pdfTheme.heading);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text(project.name || "Project", left + 24, cardY + 58);

  doc.setTextColor(...pdfTheme.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const ownerText = `Owner / Editor: Thalex Junior`;
  doc.text(ownerText, left + 24, cardY + 78);

  doc.setTextColor(...pdfTheme.heading);
  doc.setFontSize(9);
  doc.text(`Generated ${exportDate}`, pageWidth - 150, cardY + 30);
  doc.setFontSize(8);
  doc.setTextColor(...pdfTheme.muted);
  doc.text(
    `${project.status === "on_hold" ? "Paused" : project.status} · ${project.progress ?? 0}% complete`,
    pageWidth - 150,
    cardY + 44,
  );
}

export function downloadProjectReport(project: Project, goals: Goal[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const exportDate = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date());

  const addPageTitle = (title: string, y: number) => {
    doc.setTextColor(...pdfTheme.heading);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, margin, y);

    doc.setDrawColor(...pdfTheme.border);
    doc.line(margin, y + 8, margin + 140, y + 8);
  };

  const addSectionCard = (title: string, rows: Array<[string, string]>, yStart: number) => {
    const sectionHeight = Math.max(120, rows.length * 34 + 52);
    const card = addCard(doc, margin, yStart, contentWidth, sectionHeight, title);
    let currentY = card.y;

    rows.forEach(([label, value], index) => {
      const isLast = index === rows.length - 1;
      doc.setDrawColor(...pdfTheme.border);
      doc.setLineWidth(0.3);
      if (!isLast) {
        doc.line(card.x, currentY + 26, card.x + card.width, currentY + 26);
      }

      addDetailField(doc, card.x, currentY, card.width, label, value);
      currentY += 30;
    });

    return yStart + sectionHeight + 20;
  };

  const addGoalCard = (goal: Goal, index: number, yStart: number) => {
    const cardHeight = 118;
    const card = addCard(
      doc,
      margin,
      yStart,
      contentWidth,
      cardHeight,
      `${String(index + 1).padStart(2, "0")} — ${goal.title || "Untitled goal"}`,
    );

    const firstY = card.y;
    const goalRows: Array<[string, string]> = [
      ["Status", goal.status],
      ["Due date", formatDate(goal.target_date)],
      ["Progress", `${goal.progress ?? 0}%`],
    ];

    if (goal.description) {
      goalRows.unshift(["Target", goal.description]);
    }

    let currentY = firstY;
    goalRows.forEach(([label, value], rowIndex) => {
      const isLast = rowIndex === goalRows.length - 1;
      doc.setDrawColor(...pdfTheme.border);
      doc.setLineWidth(0.3);
      if (!isLast) {
        doc.line(card.x, currentY + 26, card.x + card.width, currentY + 26);
      }

      addDetailField(doc, card.x, currentY, card.width * 0.9, label, value, [15, 23, 42]);
      currentY += 30;
    });

    return yStart + cardHeight + 16;
  };

  doc.setFillColor(...pdfTheme.pageBackground);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  doc.setFillColor(...pdfTheme.headerBackground);
  doc.rect(0, 0, pageWidth, 190, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("NEXORA", margin, 64);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("PROJECT REPORT", margin, 88);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  const titleLines = doc.splitTextToSize(project.name || "Project", contentWidth);
  const titleTop = 120;
  doc.text(titleLines[0] ?? "Project", margin, titleTop);
  if (titleLines.length > 1) {
    doc.text(titleLines[1] ?? "", margin, titleTop + 18);
  }

  doc.setTextColor(200, 214, 224);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Owner / Editor: Thalex Junior`, margin, 182);
  doc.text(`Generated ${exportDate}`, pageWidth - 150, 182);

  let y = 230;
  const projectInfoRows: Array<[string, string]> = [
    ["Project name", project.name || "Project"],
    ["Status", project.status === "on_hold" ? "Paused" : project.status],
    ["Progress", `${project.progress ?? 0}%`],
    ["Start date", formatDate(project.start_date)],
    ["Deadline", formatDate(project.deadline)],
    ["Created", formatDate(project.created_at)],
  ];

  if (project.description) {
    projectInfoRows.splice(1, 0, ["Description", project.description]);
  }

  addPageTitle("Project Details", y);
  y += 20;
  y = addSectionCard("Project Information", projectInfoRows, y) ?? y;

  addPageTitle("Project Goals", y);
  y += 20;

  if (goals.length === 0) {
    const emptyCard = addCard(doc, margin, y, contentWidth, 72, "Goals");
    doc.setTextColor(...pdfTheme.body);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("No goals are currently associated with this project.", emptyCard.x, emptyCard.y + 22);
    y += 92;
  } else {
    const orderedGoals = sortGoalsChronologically(goals);
    orderedGoals.forEach((goal, index) => {
      const cardHeight = goal.description ? 146 : 118;
      if (y + cardHeight > pageHeight - 80) {
        doc.addPage();
        addPageHeaderFooter(doc, doc.getNumberOfPages(), doc.getNumberOfPages());
        y = 56;
      }
      y = addGoalCard(goal, index, y);
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    doc.setPage(pageIndex);
    addPageHeaderFooter(doc, pageIndex, totalPages);
  }

  const filename = `${sanitizeProjectFilename(project.name)}.pdf`;
  doc.save(filename);
}
