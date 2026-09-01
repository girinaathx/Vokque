import type { Block, SheetSpec, SlideSpec } from "./spec";
import { codeExtension } from "./spec";

/** Every generator returns real bytes — nothing here is mocked. */
export type Generated = { bytes: Uint8Array; ext: string };

const enc = (s: string) => new TextEncoder().encode(s);

/* ------------------------------------------------------------------ fonts */

const FONT_URLS = {
  regular: "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf",
  bold: "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf",
  mono: "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSansMono.ttf",
};
let fontCache: Record<string, ArrayBuffer> | null = null;

async function loadFonts(): Promise<Record<string, ArrayBuffer> | null> {
  if (fontCache) return fontCache;
  try {
    const entries = await Promise.all(
      Object.entries(FONT_URLS).map(async ([k, url]) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`font ${k}`);
        return [k, await r.arrayBuffer()] as const;
      }),
    );
    fontCache = Object.fromEntries(entries);
    return fontCache;
  } catch {
    return null; // fall back to the PDF standard fonts
  }
}

/* -------------------------------------------------------------------- PDF */

export async function generatePdf(title: string, blocks: Block[]): Promise<Generated> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(title || "Document");
  doc.setProducer("Avenxa");
  doc.setCreator("Avenxa");

  const fonts = await loadFonts();
  let regular, bold, mono;
  if (fonts) {
    const fontkit = (await import("@pdf-lib/fontkit")).default;
    doc.registerFontkit(fontkit);
    regular = await doc.embedFont(fonts.regular, { subset: true });
    bold = await doc.embedFont(fonts.bold, { subset: true });
    mono = await doc.embedFont(fonts.mono, { subset: true });
  } else {
    regular = await doc.embedFont(StandardFonts.Helvetica);
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
    mono = await doc.embedFont(StandardFonts.Courier);
  }
  const strip = fonts ? (s: string) => s : (s: string) => s.replace(/[^\x20-\x7e\n]/g, "");

  const W = 595.28;
  const H = 841.89;
  const M = 56;
  const maxW = W - M * 2;
  let page = doc.addPage([W, H]);
  let y = H - M;

  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const space = (n: number) => {
    if (y - n < M + 30) newPage();
    y -= n;
  };

  type F = typeof regular;
  const wrap = (text: string, font: F, size: number, width: number) => {
    const out: string[] = [];
    for (const para of text.split("\n")) {
      const words = para.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        out.push("");
        continue;
      }
      let line = "";
      for (const w of words) {
        const cand = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(cand, size) > width && line) {
          out.push(line);
          line = w;
        } else line = cand;
      }
      if (line) out.push(line);
    }
    return out;
  };

  const draw = (text: string, font: F, size: number, opts: { x?: number; color?: number } = {}) => {
    const x = opts.x ?? M;
    const width = maxW - (x - M);
    for (const line of wrap(strip(text), font, size, width)) {
      space(size * 1.5);
      page.drawText(line, {
        x,
        y,
        size,
        font,
        color: rgb(opts.color ?? 0.09, opts.color ?? 0.09, opts.color ?? 0.09),
      });
    }
  };

  if (title) {
    draw(title, bold, 24);
    space(14);
  }

  for (const b of blocks) {
    switch (b.type) {
      case "pagebreak":
        newPage();
        break;
      case "heading": {
        const size = [20, 16, 14, 12][(b.level ?? 1) - 1] ?? 14;
        space(10);
        draw(b.text ?? "", bold, size);
        space(4);
        break;
      }
      case "paragraph":
        draw(b.text ?? "", regular, 11);
        space(8);
        break;
      case "quote":
        draw(b.text ?? "", regular, 11, { x: M + 18, color: 0.35 });
        space(8);
        break;
      case "code":
        for (const line of (b.text ?? "").split("\n")) {
          space(13);
          page.drawText(strip(line).slice(0, 110), {
            x: M + 8,
            y,
            size: 9,
            font: mono,
            color: rgb(0.15, 0.15, 0.15),
          });
        }
        space(10);
        break;
      case "bullets":
      case "numbered": {
        (b.items ?? []).forEach((item, i) => {
          const marker = b.type === "bullets" ? "•" : `${i + 1}.`;
          const lines = wrap(strip(item), regular, 11, maxW - 22);
          lines.forEach((line, li) => {
            space(16);
            if (li === 0)
              page.drawText(strip(marker), { x: M + 4, y, size: 11, font: regular });
            page.drawText(line, { x: M + 22, y, size: 11, font: regular });
          });
        });
        space(8);
        break;
      }
      case "table": {
        const rows = b.rows ?? [];
        if (rows.length === 0) break;
        const cols = Math.max(...rows.map((r) => r.length));
        const cw = maxW / cols;
        rows.forEach((row, ri) => {
          const font = ri === 0 ? bold : regular;
          const cells = Array.from({ length: cols }, (_, ci) =>
            wrap(strip(String(row[ci] ?? "")), font, 9.5, cw - 10),
          );
          const height = Math.max(...cells.map((c) => c.length)) * 12 + 8;
          if (y - height < M + 30) newPage();
          const top = y;
          page.drawRectangle({
            x: M,
            y: top - height,
            width: maxW,
            height,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 0.6,
            color: ri === 0 ? rgb(0.95, 0.95, 0.95) : undefined,
          });
          cells.forEach((lines, ci) => {
            lines.forEach((line, li) => {
              page.drawText(line, {
                x: M + ci * cw + 5,
                y: top - 14 - li * 12,
                size: 9.5,
                font,
              });
            });
          });
          y = top - height;
        });
        space(12);
        break;
      }
    }
  }

  // Footer page numbers
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(`${i + 1} / ${pages.length}`, {
      x: W / 2 - 14,
      y: 28,
      size: 9,
      font: regular,
      color: rgb(0.55, 0.55, 0.55),
    });
  });

  return { bytes: await doc.save(), ext: "pdf" };
}

/* ------------------------------------------------------------------- DOCX */

export async function generateDocx(title: string, blocks: Block[]): Promise<Generated> {
  const d = await import("docx");
  const children: InstanceType<typeof d.Paragraph>[] | unknown[] = [];

  if (title) {
    children.push(
      new d.Paragraph({
        heading: d.HeadingLevel.TITLE,
        spacing: { after: 240 },
        children: [new d.TextRun({ text: title, bold: true, size: 44 })],
      }),
    );
  }

  for (const b of blocks) {
    switch (b.type) {
      case "pagebreak":
        children.push(new d.Paragraph({ children: [new d.PageBreak()] }));
        break;
      case "heading":
        children.push(
          new d.Paragraph({
            heading: [d.HeadingLevel.HEADING_1, d.HeadingLevel.HEADING_2, d.HeadingLevel.HEADING_3, d.HeadingLevel.HEADING_4][
              (b.level ?? 1) - 1
            ],
            spacing: { before: 240, after: 120 },
            children: [new d.TextRun({ text: b.text ?? "", bold: true })],
          }),
        );
        break;
      case "paragraph":
        children.push(
          new d.Paragraph({
            spacing: { after: 160 },
            children: [new d.TextRun({ text: b.text ?? "", size: 24 })],
          }),
        );
        break;
      case "quote":
        children.push(
          new d.Paragraph({
            indent: { left: 480 },
            spacing: { after: 160 },
            children: [new d.TextRun({ text: b.text ?? "", italics: true, size: 24 })],
          }),
        );
        break;
      case "code":
        for (const line of (b.text ?? "").split("\n")) {
          children.push(
            new d.Paragraph({
              children: [new d.TextRun({ text: line, font: "Consolas", size: 20 })],
            }),
          );
        }
        break;
      case "bullets":
      case "numbered":
        for (const item of b.items ?? []) {
          children.push(
            new d.Paragraph({
              numbering: { reference: b.type === "bullets" ? "av-bullets" : "av-numbers", level: 0 },
              children: [new d.TextRun({ text: item, size: 24 })],
            }),
          );
        }
        break;
      case "table": {
        const rows = b.rows ?? [];
        if (!rows.length) break;
        const cols = Math.max(...rows.map((r) => r.length));
        const total = 9360;
        const cw = Math.floor(total / cols);
        const border = { style: d.BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
        children.push(
          new d.Table({
            width: { size: cw * cols, type: d.WidthType.DXA },
            columnWidths: Array.from({ length: cols }, () => cw),
            rows: rows.map(
              (row, ri) =>
                new d.TableRow({
                  children: Array.from(
                    { length: cols },
                    (_, ci) =>
                      new d.TableCell({
                        width: { size: cw, type: d.WidthType.DXA },
                        borders: { top: border, bottom: border, left: border, right: border },
                        margins: { top: 80, bottom: 80, left: 120, right: 120 },
                        shading:
                          ri === 0 ? { fill: "F1F1F1", type: d.ShadingType.CLEAR } : undefined,
                        children: [
                          new d.Paragraph({
                            children: [
                              new d.TextRun({ text: String(row[ci] ?? ""), bold: ri === 0, size: 20 }),
                            ],
                          }),
                        ],
                      }),
                  ),
                }),
            ),
          }),
        );
        children.push(new d.Paragraph({ text: "" }));
        break;
      }
    }
  }

  const doc = new d.Document({
    creator: "Avenxa",
    title: title || "Document",
    styles: { default: { document: { run: { font: "Arial", size: 24 } } } },
    numbering: {
      config: [
        {
          reference: "av-bullets",
          levels: [
            {
              level: 0,
              format: d.LevelFormat.BULLET,
              text: "\u2022",
              alignment: d.AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        {
          reference: "av-numbers",
          levels: [
            {
              level: 0,
              format: d.LevelFormat.DECIMAL,
              text: "%1.",
              alignment: d.AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children: children as any,
      },
    ],
  });

  const buf = await d.Packer.toBuffer(doc);
  return { bytes: new Uint8Array(buf), ext: "docx" };
}

/* -------------------------------------------------------- plain text docs */

function blocksToMarkdown(title: string, blocks: Block[]): string {
  const out: string[] = [];
  if (title) out.push(`# ${title}`, "");
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        out.push(`${"#".repeat((b.level ?? 1) + 1)} ${b.text ?? ""}`, "");
        break;
      case "paragraph":
        out.push(b.text ?? "", "");
        break;
      case "quote":
        out.push(`> ${b.text ?? ""}`, "");
        break;
      case "code":
        out.push("```", b.text ?? "", "```", "");
        break;
      case "bullets":
        out.push(...(b.items ?? []).map((i) => `- ${i}`), "");
        break;
      case "numbered":
        out.push(...(b.items ?? []).map((i, n) => `${n + 1}. ${i}`), "");
        break;
      case "table": {
        const rows = b.rows ?? [];
        if (!rows.length) break;
        out.push(`| ${rows[0].join(" | ")} |`);
        out.push(`| ${rows[0].map(() => "---").join(" | ")} |`);
        rows.slice(1).forEach((r) => out.push(`| ${r.join(" | ")} |`));
        out.push("");
        break;
      }
      case "pagebreak":
        out.push("---", "");
        break;
    }
  }
  return out.join("\n");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function blocksToHtml(title: string, blocks: Block[]): string {
  const body: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        body.push(`<h${(b.level ?? 1) + 1}>${esc(b.text ?? "")}</h${(b.level ?? 1) + 1}>`);
        break;
      case "paragraph":
        body.push(`<p>${esc(b.text ?? "")}</p>`);
        break;
      case "quote":
        body.push(`<blockquote>${esc(b.text ?? "")}</blockquote>`);
        break;
      case "code":
        body.push(`<pre><code>${esc(b.text ?? "")}</code></pre>`);
        break;
      case "bullets":
        body.push(`<ul>${(b.items ?? []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`);
        break;
      case "numbered":
        body.push(`<ol>${(b.items ?? []).map((i) => `<li>${esc(i)}</li>`).join("")}</ol>`);
        break;
      case "table": {
        const rows = b.rows ?? [];
        if (!rows.length) break;
        const head = `<thead><tr>${rows[0].map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>`;
        const tb = rows
          .slice(1)
          .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
          .join("");
        body.push(`<table>${head}<tbody>${tb}</tbody></table>`);
        break;
      }
      case "pagebreak":
        body.push(`<hr class="page-break" />`);
        break;
    }
  }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title || "Document")}</title>
<style>
:root{color-scheme:light}
body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:44rem;margin:3rem auto;padding:0 1.25rem;line-height:1.65;color:#111}
h1{font-size:2rem;letter-spacing:-.02em}
table{border-collapse:collapse;width:100%;margin:1rem 0}
th,td{border:1px solid #ddd;padding:.5rem .65rem;text-align:left;font-size:.95rem}
th{background:#f4f4f5}
blockquote{border-left:3px solid #ddd;margin:0;padding-left:1rem;color:#555}
pre{background:#f6f6f7;padding:1rem;border-radius:12px;overflow:auto}
.page-break{page-break-after:always;border:0}
</style></head>
<body><h1>${esc(title || "Document")}</h1>
${body.join("\n")}
</body></html>`;
}

function rtfEscape(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/[{}]/g, (m) => `\\${m}`)
    .replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0)}?`)
    .replace(/\n/g, "\\line ");
}

function blocksToRtf(title: string, blocks: Block[]): string {
  const parts: string[] = [
    "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\fs24",
    `{\\b\\fs44 ${rtfEscape(title || "Document")}}\\par\\par`,
  ];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        parts.push(`{\\b\\fs${36 - (b.level ?? 1) * 4} ${rtfEscape(b.text ?? "")}}\\par`);
        break;
      case "paragraph":
      case "code":
        parts.push(`${rtfEscape(b.text ?? "")}\\par\\par`);
        break;
      case "quote":
        parts.push(`{\\i ${rtfEscape(b.text ?? "")}}\\par\\par`);
        break;
      case "bullets":
        (b.items ?? []).forEach((i) => parts.push(`\\bullet\\tab ${rtfEscape(i)}\\par`));
        parts.push("\\par");
        break;
      case "numbered":
        (b.items ?? []).forEach((i, n) => parts.push(`${n + 1}.\\tab ${rtfEscape(i)}\\par`));
        parts.push("\\par");
        break;
      case "table":
        (b.rows ?? []).forEach((r) => parts.push(`${rtfEscape(r.join("\t"))}\\par`));
        parts.push("\\par");
        break;
      case "pagebreak":
        parts.push("\\page");
        break;
    }
  }
  parts.push("}");
  return parts.join("\n");
}

export async function generateDocument(
  format: string,
  title: string,
  blocks: Block[],
): Promise<Generated> {
  switch (format) {
    case "pdf":
      return generatePdf(title, blocks);
    case "docx":
      return generateDocx(title, blocks);
    case "html":
      return { bytes: enc(blocksToHtml(title, blocks)), ext: "html" };
    case "rtf":
      return { bytes: enc(blocksToRtf(title, blocks)), ext: "rtf" };
    case "txt":
      return {
        bytes: enc(blocksToMarkdown(title, blocks).replace(/[#>*`|-]{1,3}\s?/g, "")),
        ext: "txt",
      };
    default:
      return { bytes: enc(blocksToMarkdown(title, blocks)), ext: "md" };
  }
}

/* ----------------------------------------------------------- spreadsheets */

const delimited = (sheet: SheetSpec, sep: string) => {
  const q = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return sep === "," && /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [sheet.columns, ...sheet.rows].map((r) => r.map(q).join(sep)).join("\n");
};

export async function generateSpreadsheet(
  format: string,
  sheets: SheetSpec[],
): Promise<Generated> {
  const first = sheets[0];
  if (!first) throw new Error("No sheet data provided");

  if (format === "csv") return { bytes: enc(delimited(first, ",")), ext: "csv" };
  if (format === "tsv") return { bytes: enc(delimited(first, "\t")), ext: "tsv" };
  if (format === "json") {
    const payload = sheets.map((s) => ({
      sheet: s.name,
      rows: s.rows.map((r) => Object.fromEntries(s.columns.map((c, i) => [c, r[i] ?? null]))),
    }));
    return {
      bytes: enc(JSON.stringify(sheets.length === 1 ? payload[0].rows : payload, null, 2)),
      ext: "json",
    };
  }
  if (format === "xml") {
    const tag = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^(\d)/, "_$1");
    const body = sheets
      .map(
        (s) =>
          `  <sheet name="${esc(s.name)}">\n` +
          s.rows
            .map(
              (r) =>
                `    <row>\n` +
                s.columns
                  .map((c, i) => `      <${tag(c)}>${esc(String(r[i] ?? ""))}</${tag(c)}>`)
                  .join("\n") +
                `\n    </row>`,
            )
            .join("\n") +
          `\n  </sheet>`,
      )
      .join("\n");
    return { bytes: enc(`<?xml version="1.0" encoding="UTF-8"?>\n<data>\n${body}\n</data>`), ext: "xml" };
  }

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const aoa = [s.columns, ...s.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
    // Real formulas: any cell starting with "=" becomes a live formula.
    s.rows.forEach((row, ri) => {
      row.forEach((val, ci) => {
        if (typeof val === "string" && val.startsWith("=")) {
          const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
          ws[ref] = { t: "n", f: val.slice(1) };
        }
      });
    });
    ws["!cols"] = (s.columnWidths ?? s.columns.map((c) => Math.min(40, Math.max(12, c.length + 4)))).map(
      (wch) => ({ wch }),
    );
    XLSX.utils.book_append_sheet(wb, ws, (s.name || "Sheet").slice(0, 31));
  }
  const out = XLSX.write(wb, {
    bookType: format === "ods" ? "ods" : "xlsx",
    type: "array",
    compression: true,
  });
  return { bytes: new Uint8Array(out as ArrayBuffer), ext: format === "ods" ? "ods" : "xlsx" };
}

/* ---------------------------------------------------------- presentations */

export async function generatePresentation(
  title: string,
  slides: SlideSpec[],
  theme: { bg: string; fg: string; accent: string } = {
    bg: "0B0B0F",
    fg: "FFFFFF",
    accent: "6EA8FF",
  },
): Promise<Generated> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Avenxa";
  pptx.title = title || "Presentation";

  const cover = pptx.addSlide();
  cover.background = { color: theme.bg };
  cover.addText(title || "Presentation", {
    x: 0.7,
    y: 2.1,
    w: 8.6,
    h: 1.4,
    fontSize: 46,
    bold: true,
    color: theme.fg,
    fontFace: "Arial",
  });
  cover.addShape(pptx.ShapeType.rect, { x: 0.7, y: 3.6, w: 1.6, h: 0.06, fill: { color: theme.accent } });

  for (const s of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: theme.bg };
    slide.addText(s.title, {
      x: 0.6,
      y: 0.45,
      w: 8.8,
      h: 0.9,
      fontSize: 30,
      bold: true,
      color: theme.fg,
      fontFace: "Arial",
    });
    let top = 1.5;
    if (s.subtitle) {
      slide.addText(s.subtitle, {
        x: 0.6,
        y: top,
        w: 8.8,
        h: 0.5,
        fontSize: 18,
        italic: true,
        color: theme.accent,
      });
      top += 0.6;
    }
    if (s.bullets?.length) {
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
        { x: 0.75, y: top, w: 8.5, h: 3.4, fontSize: 20, color: theme.fg, lineSpacingMultiple: 1.3 },
      );
      top += Math.min(3.4, s.bullets.length * 0.55);
    }
    if (s.table?.length) {
      slide.addTable(
        s.table.map((row, ri) =>
          row.map((c) => ({
            text: String(c),
            options: {
              bold: ri === 0,
              color: theme.fg,
              fill: { color: ri === 0 ? theme.accent + "" : theme.bg },
              fontSize: 14,
            },
          })),
        ),
        { x: 0.6, y: top, w: 8.8, border: { pt: 0.5, color: "444444" } },
      );
    }
    if (s.chart) {
      slide.addChart(
        s.chart.type === "pie" ? pptx.ChartType.pie : s.chart.type === "line" ? pptx.ChartType.line : pptx.ChartType.bar,
        [{ name: s.title, labels: s.chart.labels, values: s.chart.values }],
        { x: 0.8, y: top, w: 8.4, h: 3.2, showLegend: true, chartColors: [theme.accent, "9AA4B2", "FFD166"] },
      );
    }
    if (s.notes) slide.addNotes(s.notes);
  }

  const out = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  return { bytes: new Uint8Array(out), ext: "pptx" };
}

/* ------------------------------------------------------------------- misc */

export function generateCodeFile(language: string, content: string): Generated {
  return { bytes: enc(content), ext: codeExtension(language) };
}

export async function generateZip(
  files: { filename: string; bytes: Uint8Array }[],
): Promise<Generated> {
  const { zipSync } = await import("fflate");
  const map: Record<string, Uint8Array> = {};
  files.forEach((f, i) => {
    const name = map[f.filename] ? `${i}-${f.filename}` : f.filename;
    map[name] = f.bytes;
  });
  return { bytes: zipSync(map, { level: 6 }), ext: "zip" };
}

/** Real image generation through the Lovable AI Gateway. */
export async function generateImageBytes(
  prompt: string,
  size: "1024x1024" | "1536x1024" | "1024x1536",
): Promise<Generated> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Image generation is not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-image-2", prompt, size, quality: "low" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 402) throw new Error("AI credits exhausted — image generation unavailable.");
    if (res.status === 429) throw new Error("Rate limited — please retry in a moment.");
    throw new Error(`Image generation failed (${res.status}). ${text.slice(0, 160)}`);
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image generation returned no image data.");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, ext: "png" };
}

export function generateSvg(svg: string): Generated {
  const clean = svg.trim().replace(/<script[\s\S]*?<\/script>/gi, "");
  if (!clean.startsWith("<svg")) throw new Error("SVG content must start with <svg");
  return { bytes: enc(clean), ext: "svg" };
}
