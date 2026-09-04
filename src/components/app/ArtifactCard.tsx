import { Download, FileText, Loader2, AlertCircle } from "lucide-react";
import type { ArtifactMeta } from "@/lib/artifacts/spec";

/**
 * Generated artifacts. Images render directly in the conversation with a tiny
 * download control; other files render as a slim glass chip.
 */
export function ArtifactCard({ artifact }: { artifact: ArtifactMeta }) {
  const isImage = artifact.mimeType.startsWith("image/");

  if (isImage) {
    return (
      <figure className="animate-fade-up group relative my-3 w-full max-w-sm">
        <img
          src={artifact.url}
          alt={artifact.filename}
          loading="lazy"
          className="w-full rounded-2xl object-contain shadow-[0_10px_36px_-22px_rgba(0,0,0,0.5)]"
        />
        <a
          href={artifact.url}
          download={artifact.filename}
          aria-label="Download image"
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#050505] shadow-[0_2px_8px_-3px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </figure>
    );
  }

  return (
    <a
      href={artifact.url}
      download={artifact.filename}
      className="glass animate-fade-up my-2 inline-flex max-w-full items-center gap-2 rounded-full py-1.5 pr-3 pl-3 text-[13px] text-[#050505] transition active:scale-[0.98]"
    >
      <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="min-w-0 truncate">{artifact.filename}</span>
      <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </a>
  );
}

export function ArtifactPending({ label }: { label: string }) {
  return (
    <div className="glass-thin my-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] text-[#111111]">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {label}
    </div>
  );
}

export function ArtifactError({ message }: { message: string }) {
  return (
    <div className="glass-thin text-destructive my-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]">
      <AlertCircle className="h-3.5 w-3.5" /> {message}
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
