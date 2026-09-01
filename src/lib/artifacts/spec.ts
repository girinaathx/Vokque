import { z } from "zod";

/** Shared, client-safe artifact contracts. No server code here. */

export const BlockSchema = z.object({
  type: z
    .enum(["heading", "paragraph", "bullets", "numbered", "table", "pagebreak", "code", "quote"])
    .describe("Block kind"),
  text: z.string().optional().describe("Text for heading/paragraph/code/quote"),
  level: z.number().int().min(1).max(4).optional().describe("Heading level 1-4"),
  items: z.array(z.string()).optional().describe("List items for bullets/numbered"),
  rows: z
    .array(z.array(z.string()))
    .optional()
    .describe("Table rows; the first row is the header row"),
});
export type Block = z.infer<typeof BlockSchema>;

export const DOC_FORMATS = ["pdf", "docx", "rtf", "html", "md", "txt"] as const;
export const SHEET_FORMATS = ["xlsx", "csv", "tsv", "ods", "json", "xml"] as const;

export const SheetSchema = z.object({
  name: z.string().describe("Worksheet name"),
  columns: z.array(z.string()).describe("Header row labels"),
  rows: z
    .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
    .describe("Data rows. Use a leading '=' string for a real Excel formula."),
  columnWidths: z.array(z.number()).optional().describe("Column widths in characters"),
});
export type SheetSpec = z.infer<typeof SheetSchema>;

export const SlideSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  notes: z.string().optional().describe("Speaker notes"),
  table: z.array(z.array(z.string())).optional(),
  chart: z
    .object({
      type: z.enum(["bar", "line", "pie"]),
      labels: z.array(z.string()),
      values: z.array(z.number()),
    })
    .optional(),
});
export type SlideSpec = z.infer<typeof SlideSchema>;

/** What the chat UI receives for every generated file. */
export type ArtifactMeta = {
  id: string;
  filename: string;
  mimeType: string;
  extension: string;
  kind: string;
  sizeBytes: number;
  url: string;
  status: "ready";
};

export const EXT_META: Record<string, { mime: string; kind: string }> = {
  pdf: { mime: "application/pdf", kind: "PDF Document" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    kind: "Word Document",
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "Excel Spreadsheet",
  },
  ods: { mime: "application/vnd.oasis.opendocument.spreadsheet", kind: "OpenDocument Sheet" },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    kind: "PowerPoint Presentation",
  },
  csv: { mime: "text/csv", kind: "CSV Data" },
  tsv: { mime: "text/tab-separated-values", kind: "TSV Data" },
  json: { mime: "application/json", kind: "JSON Data" },
  xml: { mime: "application/xml", kind: "XML Data" },
  txt: { mime: "text/plain", kind: "Text File" },
  md: { mime: "text/markdown", kind: "Markdown File" },
  rtf: { mime: "application/rtf", kind: "Rich Text Document" },
  html: { mime: "text/html", kind: "HTML Document" },
  zip: { mime: "application/zip", kind: "ZIP Archive" },
  png: { mime: "image/png", kind: "PNG Image" },
  jpg: { mime: "image/jpeg", kind: "JPEG Image" },
  webp: { mime: "image/webp", kind: "WebP Image" },
  svg: { mime: "image/svg+xml", kind: "SVG Image" },
  gif: { mime: "image/gif", kind: "GIF Image" },
};

const CODE_EXT: Record<string, string> = {
  python: "py",
  javascript: "js",
  typescript: "ts",
  jsx: "jsx",
  tsx: "tsx",
  java: "java",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  go: "go",
  rust: "rs",
  php: "php",
  sql: "sql",
  html: "html",
  css: "css",
  yaml: "yaml",
  json: "json",
  xml: "xml",
  shell: "sh",
};
export const CODE_LANGUAGES = Object.keys(CODE_EXT);
export const codeExtension = (lang: string) => CODE_EXT[lang] ?? "txt";

/** Strict filename sanitiser — blocks traversal, control chars and odd unicode. */
export function sanitizeFilename(raw: string, fallbackExt: string): string {
  const base = (raw || "file")
    .split(/[\\/]/)
    .pop()!
    .normalize("NFKD")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+/, "")
    .slice(0, 90);

  const dot = base.lastIndexOf(".");
  const stem = (dot > 0 ? base.slice(0, dot) : base) || "file";
  const ext = (dot > 0 ? base.slice(dot + 1) : "").toLowerCase();
  const finalExt = (ext && /^[a-z0-9]{1,5}$/.test(ext) ? ext : fallbackExt).toLowerCase();
  return `${stem.toLowerCase()}.${finalExt}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
