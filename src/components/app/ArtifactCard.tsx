import { Download, FileText, Image as ImageIcon, Loader2, AlertCircle } from "lucide-react";
import { formatBytes, type ArtifactMeta } from "@/lib/artifacts/spec";
import { cn } from "@/lib/utils";

const ICON_TINT: Record<string, string> = {
  pdf: "text-rose-400",
  docx: "text-sky-400",
  rtf: "text-sky-400",
  xlsx: "text-emerald-400",
  ods: "text-emerald-400",
  csv: "text-emerald-400",
  tsv: "text-emerald-400",
  pptx: "text-orange-400",
  zip: "text-amber-400",
  png: "text-violet-400",
  svg: "text-violet-400",
};

/** Liquid-glass card shown in chat for every real generated file. */
export function ArtifactCard({ artifact }: { artifact: ArtifactMeta }) {
  const isImage = artifact.mimeType.startsWith("image/");
  const tint = ICON_TINT[artifact.extension] ?? "text-foreground/70";

  return (
    <div className="animate-fade-up my-3 w-full max-w-md overflow-hidden rounded-3xl border border-white/12 bg-white/[0.06] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
      {isImage && (
        <a href={artifact.url} target="_blank" rel="noreferrer" className="block">
          <img
            src={artifact.url}
            alt={artifact.filename}
            loading="lazy"
            className="max-h-80 w-full object-cover"
          />
        </a>
      )}
      <div className="flex items-center gap-3 p-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.07]",
            tint,
          )}
        >
          {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">{artifact.filename}</span>
          <span className="text-muted-foreground block text-[12px]">
            {artifact.kind} · {formatBytes(artifact.sizeBytes)}
          </span>
        </span>
        <a
          href={artifact.url}
          download={artifact.filename}
          className="flex h-10 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.08] px-4 text-[13px] font-medium transition-transform active:scale-95"
        >
          <Download className="h-4 w-4" /> Save
        </a>
      </div>
    </div>
  );
}

export function ArtifactPending({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground my-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[13px] backdrop-blur-xl">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {label}
    </div>
  );
}

export function ArtifactError({ message }: { message: string }) {
  return (
    <div className="text-destructive my-3 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-[13px] backdrop-blur-xl">
      <AlertCircle className="h-4 w-4" /> {message}
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  "tool-create_document": "Writing your document…",
  "tool-create_spreadsheet": "Building your spreadsheet…",
  "tool-create_presentation": "Designing your slides…",
  "tool-create_code_file": "Writing your code file…",
  "tool-create_text_file": "Creating your file…",
  "tool-generate_image": "Generating your image…",
  "tool-create_svg_image": "Drawing your vector…",
  "tool-create_zip_archive": "Packing your archive…",
};

type ToolPart = {
  type: string;
  state?: string;
  output?: { artifact?: ArtifactMeta; error?: string };
};

/** Renders any artifact tool part of a message. */
export function ArtifactParts({ parts }: { parts: unknown[] }) {
  const tools = (parts as ToolPart[]).filter(
    (p) => typeof p?.type === "string" && p.type in TOOL_LABELS,
  );
  if (tools.length === 0) return null;
  return (
    <>
      {tools.map((p, i) => {
        if (p.output?.artifact) return <ArtifactCard key={i} artifact={p.output.artifact} />;
        if (p.output?.error) return <ArtifactError key={i} message={p.output.error} />;
        return <ArtifactPending key={i} label={TOOL_LABELS[p.type]} />;
      })}
    </>
  );
}
