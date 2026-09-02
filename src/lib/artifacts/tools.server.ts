import { tool } from "ai";
import { z } from "zod";
import {
  BlockSchema,
  CODE_LANGUAGES,
  DOC_FORMATS,
  SHEET_FORMATS,
  SheetSchema,
  SlideSchema,
  type ArtifactMeta,
} from "./spec";
import {
  generateCodeFile,
  generateDocument,
  generateImageBytes,
  generatePresentation,
  generateSpreadsheet,
  generateSvg,
  generateZip,
} from "./generate.server";
import { loadArtifactBytes, storeArtifact, type StoreContext } from "./store.server";

type ToolResult = { artifact: ArtifactMeta } | { error: string };

async function run(
  ctx: StoreContext,
  filename: string,
  work: () => Promise<{ bytes: Uint8Array; ext: string }> | { bytes: Uint8Array; ext: string },
): Promise<ToolResult> {
  try {
    const { bytes, ext } = await work();
    const artifact = await storeArtifact(ctx, { filename, ext, bytes });
    return { artifact };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "File generation failed";
    console.error("[artifact]", filename, msg);
    return { error: msg };
  }
}

export function createArtifactTools(ctx: StoreContext) {
  return {
    create_document: tool({
      description:
        "Create a real, downloadable document (PDF, DOCX, RTF, HTML, Markdown or TXT) from structured content. Use for reports, letters, essays, resumes, contracts, guides, notes.",
      inputSchema: z.object({
        format: z.enum(DOC_FORMATS),
        filename: z.string().describe("Desired file name, e.g. project-report.pdf"),
        title: z.string().describe("Document title"),
        blocks: z.array(BlockSchema).describe("Ordered document content blocks"),
      }),
      execute: ({ format, filename, title, blocks }) =>
        run(ctx, filename, () => generateDocument(format, title, blocks)),
    }),

    create_spreadsheet: tool({
      description:
        "Create a real spreadsheet or dataset file (XLSX, ODS, CSV, TSV, JSON, XML). Supports multiple sheets and live Excel formulas (prefix a cell value with '=').",
      inputSchema: z.object({
        format: z.enum(SHEET_FORMATS),
        filename: z.string(),
        sheets: z.array(SheetSchema),
      }),
      execute: ({ format, filename, sheets }) =>
        run(ctx, filename, () => generateSpreadsheet(format, sheets)),
    }),

    create_presentation: tool({
      description:
        "Create a real PowerPoint (.pptx) presentation with a cover slide, bullet slides, tables, charts and speaker notes.",
      inputSchema: z.object({
        filename: z.string(),
        title: z.string(),
        slides: z.array(SlideSchema),
      }),
      execute: ({ filename, title, slides }) =>
        run(ctx, filename, () => generatePresentation(title, slides)),
    }),

    create_code_file: tool({
      description:
        "Create a real source-code file the user can download and run. Write complete, working code — never placeholders.",
      inputSchema: z.object({
        language: z.enum(CODE_LANGUAGES as [string, ...string[]]),
        filename: z.string(),
        content: z.string().describe("Full file contents"),
      }),
      execute: ({ language, filename, content }) =>
        run(ctx, filename, () => generateCodeFile(language, content)),
    }),

    create_text_file: tool({
      description:
        "Create a plain text, Markdown, JSON, XML, CSV or HTML file from raw content you supply verbatim.",
      inputSchema: z.object({
        filename: z.string(),
        extension: z.enum(["txt", "md", "json", "xml", "csv", "html"]),
        content: z.string(),
      }),
      execute: ({ filename, extension, content }) =>
        run(ctx, filename, () => ({
          bytes: new TextEncoder().encode(content),
          ext: extension,
        })),
    }),

    generate_image: tool({
      description:
        "Generate a real PNG image from a text prompt. Use for illustrations, concepts, mockups, art, diagrams-as-art.",
      inputSchema: z.object({
        prompt: z.string().describe("Detailed visual description"),
        filename: z.string(),
        size: z.enum(["1024x1024", "1536x1024", "1024x1536"]),
      }),
      execute: ({ prompt, filename, size }) =>
        run(ctx, filename, () => generateImageBytes(prompt, size)),
    }),

    create_svg_image: tool({
      description:
        "Create a real SVG vector image (logos, icons, diagrams, charts) from SVG markup you write yourself.",
      inputSchema: z.object({
        filename: z.string(),
        svg: z.string().describe("Complete <svg>...</svg> markup"),
      }),
      execute: ({ filename, svg }) => run(ctx, filename, () => generateSvg(svg)),
    }),

    create_zip_archive: tool({
      description:
        "Bundle files you created earlier in this conversation into a single downloadable ZIP archive.",
      inputSchema: z.object({
        filename: z.string(),
        artifact_ids: z.array(z.string()).describe("Ids returned by earlier file-creation tools"),
      }),
      execute: async ({ filename, artifact_ids }) =>
        run(ctx, filename, async () => {
          const loaded = (
            await Promise.all(artifact_ids.map((id) => loadArtifactBytes(ctx, id)))
          ).filter(Boolean) as { filename: string; bytes: Uint8Array }[];
          if (loaded.length === 0) throw new Error("None of those files could be found");
          return generateZip(loaded);
        }),
    }),
  };
}

export type ArtifactTools = ReturnType<typeof createArtifactTools>;
