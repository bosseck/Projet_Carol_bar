import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatLong, formatShort } from "./dates";
import { pdfMoney, pdfNumber } from "./format";
import type { ProductRow, Totals } from "./metrics";

export interface PdfPayload {
  rows: ProductRow[];
  totals: Totals;
  start: string;
  end: string;
  segment: string;
  category: string;
  query: string;
  stock: string;
  generatedAt: string;
}

function pdfSafe(value: string) {
  return value
    .replace(/\u2212/g, "-")
    .replace(/[\u2012\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u202f\u00a0]/g, " ");
}

const INK: [number, number, number] = [28, 23, 19];
const CREAM: [number, number, number] = [246, 241, 232];
const AMBER: [number, number, number] = [184, 97, 26];
const PAPER: [number, number, number] = [255, 252, 247];
const BAND: [number, number, number] = [232, 214, 186];
const ALT: [number, number, number] = [248, 243, 234];
const LINE: [number, number, number] = [226, 214, 196];

function paintBackground(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, w, h, "F");
}

function paintFooter(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(...INK);
  doc.rect(0, h - 10, w, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...CREAM);
  doc.text("La Terrasse  ·  Bar & Épicerie  ·  PK13  ·  Document interne", 12, h - 4.2);
}

/** Logo du comptoir : casier de bouteilles posé sur un comptoir. */
function paintLogo(doc: jsPDF, x: number, y: number, size = 16) {
  doc.setFillColor(18, 36, 29);
  doc.roundedRect(x, y, size, size, 3, 3, "F");
  doc.setFillColor(227, 164, 92);
  doc.rect(x + size * 0.19, y + size * 0.63, size * 0.62, size * 0.09, "F");
  doc.setFillColor(243, 226, 204);
  const bottle = size * 0.11;
  doc.roundedRect(x + size * 0.25, y + size * 0.32, bottle, size * 0.29, bottle / 2, bottle / 2, "F");
  doc.roundedRect(x + size * 0.445, y + size * 0.32, bottle, size * 0.29, bottle / 2, bottle / 2, "F");
  doc.roundedRect(x + size * 0.64, y + size * 0.32, bottle, size * 0.29, bottle / 2, bottle / 2, "F");
}

function slimHeader(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...INK);
  doc.rect(0, 0, w, 12, "F");
  doc.setFillColor(...AMBER);
  doc.rect(0, 12, w, 1.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...CREAM);
  doc.text("LA TERRASSE  ·  État des stocks  ·  PK13", 12, 7.6);
}

export function exportStockPdf(payload: PdfPayload) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setProperties({
    title: "État des stocks — La Terrasse",
    subject: "Suivi des stocks du bar et de l'épicerie",
    author: "Comptoir La Terrasse",
    creator: "Comptoir",
  });

  const w = doc.internal.pageSize.getWidth();
  paintBackground(doc);
  doc.setFillColor(...INK);
  doc.rect(0, 0, w, 28, "F");
  doc.setFillColor(...AMBER);
  doc.rect(0, 28, w, 1.5, "F");

  paintLogo(doc, 12, 8, 18);
  doc.setTextColor(...CREAM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(pdfSafe("LA TERRASSE"), 36, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(227, 164, 92);
  doc.text("Bar & Épicerie  ·  PK13", 36, 20);
  doc.setTextColor(...CREAM);
  doc.setFontSize(8);
  doc.text("Comptoir des stocks  ·  montants en FCFA", 36, 25);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("ÉTAT DES STOCKS", w - 12, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(pdfSafe(`${formatShort(payload.start)} - ${formatLong(payload.end)}`), w - 12, 18, { align: "right" });
  doc.setFontSize(8);
  doc.text(`Généré le ${payload.generatedAt}`, w - 12, 23.5, { align: "right" });

  doc.setTextColor(...INK);
  doc.setFontSize(8.5);
  const filterLine = pdfSafe(`Segment : ${payload.segment}    Catégorie : ${payload.category}    Stock : ${payload.stock}    Recherche : ${payload.query || "-"}    ${payload.totals.produits} produit${payload.totals.produits > 1 ? "s" : ""}`);
  doc.text(filterLine, 12, 36);

  const cards = [
    { label: "ARGENT EN CAISSE", value: pdfMoney(payload.totals.caisse) },
    { label: "BÉNÉFICE RÉALISÉ", value: pdfMoney(payload.totals.beneficeRealise) },
    { label: "VALEUR DU STOCK", value: pdfMoney(payload.totals.valeurAchats) },
    { label: "STOCK AU COÛT", value: pdfMoney(payload.totals.stockCout) },
  ];
  const gap = 4;
  const boxW = (w - 24 - gap * 3) / 4;
  cards.forEach((card, i) => {
    const x = 12 + i * (boxW + gap);
    doc.setFillColor(...PAPER);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, 40, boxW, 17, 1.6, 1.6, "FD");
    doc.setFillColor(...AMBER);
    doc.rect(x, 40, 1.4, 17, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(120, 98, 74);
    doc.text(card.label, x + 4, 46);
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(card.value, x + 4, 53);
  });

  const body = payload.rows.map((row) => {
    const open =
      row.stockDebut > 0
        ? `${pdfNumber(row.stockDebut)} + ${pdfNumber(row.qteEntree)} x ${row.product.uniteLot} - ${pdfNumber(row.qteSortie)}`
        : `${pdfNumber(row.qteEntree)} x ${row.product.uniteLot} - ${pdfNumber(row.qteSortie)}`;
    return [
      `${row.product.name}\n${row.product.category}`,
      `${row.product.uniteLot}\n${row.product.unitPlural}`,
      `${pdfNumber(row.qteEntree)}\n${row.product.lotPlural}`,
      `${pdfNumber(row.qteSortie)}\n${row.product.unitPlural}`,
      `${pdfNumber(row.reste)}\n${open}`,
      pdfNumber(row.product.prixAchat),
      pdfNumber(row.product.prixUnitaire),
      pdfNumber(row.beneficeLot),
      pdfNumber(row.beneficeRealise),
      pdfNumber(row.caisse),
    ];
  });

  const foot = [[
    "TOTAUX",
    "",
    pdfNumber(payload.totals.qteEntree),
    pdfNumber(payload.totals.unites),
    pdfNumber(payload.totals.reste),
    "",
    "",
    "",
    pdfNumber(payload.totals.beneficeRealise),
    pdfNumber(payload.totals.caisse),
  ]];

  autoTable(doc, {
    startY: 62,
    margin: { top: 18, bottom: 16, left: 12, right: 12 },
    head: [[
      "Produit",
      "Unité/lot",
      "Qté entrée",
      "Qté sortie",
      "Reste",
      "Prix d'achat",
      "Prix unit.",
      "Bénéfice",
      "Bén. réalisé",
      "Caisse",
    ]],
    body: body.length ? body : [["Aucun produit pour ce filtre", "", "", "", "", "", "", "", "", ""]],
    foot,
    showHead: "everyPage",
    showFoot: "lastPage",
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 7.4,
      textColor: INK,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1.3, right: 1.3 },
      lineColor: LINE,
      lineWidth: 0.12,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: INK,
      textColor: CREAM,
      fontStyle: "bold",
      fontSize: 7,
      valign: "middle",
    },
    footStyles: {
      fillColor: BAND,
      textColor: INK,
      fontStyle: "bold",
      fontSize: 7.4,
    },
    alternateRowStyles: { fillColor: ALT },
    columnStyles: {
      0: { cellWidth: 52, halign: "left" },
      1: { cellWidth: 20, halign: "right" },
      2: { cellWidth: 22, halign: "right" },
      3: { cellWidth: 22, halign: "right" },
      4: { cellWidth: 36, halign: "right" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 22, halign: "right" },
      8: { cellWidth: 26, halign: "right" },
      9: { cellWidth: 27, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section !== "body" || !payload.rows.length) return;
      const row = payload.rows[data.row.index];
      if (!row) return;
      if (row.status === "rupture") data.cell.styles.fillColor = [248, 232, 228];
      else if (row.status === "bas") data.cell.styles.fillColor = [250, 240, 220];
      if (row.product.id === "kadji" && data.column.index === 0) {
        data.cell.styles.fontStyle = "bold";
      }
    },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        paintBackground(doc);
        slimHeader(doc);
      }
    },
    didDrawPage: () => {
      paintFooter(doc);
    },
  });

  const pageH = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...CREAM);
    doc.text(`${i} / ${total}`, w - 12, pageH - 4.2, { align: "right" });
  }

  const stamp = payload.end;
  doc.save(`La-Terrasse-stocks-${stamp}.pdf`);
}
