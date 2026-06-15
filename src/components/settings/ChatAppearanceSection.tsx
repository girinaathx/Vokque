import { useRef, useState } from "react";
import {
  useChatAppearance,
  PRESET_GROUPS,
  type ChatAppearance,
  type BubbleSize,
  type AnimationMode,
} from "@/lib/chat-appearance";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Download,
  Upload,
  Plus,
  Copy as CopyIcon,
  Trash2,
  RotateCcw,
  Pencil,
} from "lucide-react";

type ColorKey =
  | "userBg"
  | "aiBg"
  | "textColor"
  | "secondaryText"
  | "borderColor"
  | "timestampColor"
  | "accentColor";

const COLOR_FIELDS: Array<{ key: ColorKey; label: string }> = [
  { key: "userBg", label: "User bubble" },
  { key: "aiBg", label: "AI bubble" },
  { key: "textColor", label: "Bubble text" },
  { key: "secondaryText", label: "Secondary text" },
  { key: "borderColor", label: "Bubble border" },
  { key: "timestampColor", label: "Timestamp" },
  { key: "accentColor", label: "Accent" },
];

function toHex(v: string): string {
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
  const m = v.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const [r, g, b] = m[1].split(",").map((x) => parseInt(x.trim(), 10));
    if ([r, g, b].every((n) => !Number.isNaN(n))) {
      return (
        "#" +
        [r, g, b]
          .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
          .join("")
      );
    }
  }
  return "#000000";
}

export function ChatAppearanceSection() {
  const {
    appearance,
    setAppearance,
    reset,
    themes,
    saveTheme,
    applyTheme,
    renameTheme,
    duplicateTheme,
    deleteTheme,
    exportThemes,
    importThemes,
  } = useChatAppearance();

  const [activeField, setActiveField] = useState<ColorKey>("userBg");
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof ChatAppearance>(k: K, v: ChatAppearance[K]) =>
    setAppearance({ [k]: v } as Partial<ChatAppearance>);

  return (
    <div className="space-y-4">
      {/* Live preview */}
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <h2 className="font-display mb-3 text-lg font-semibold tracking-tight">
          Chat Appearance
        </h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Live preview. Changes apply instantly across every chat.
        </p>

        <div className="rounded-2xl border border-foreground/10 bg-background/40 p-4">
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <div className="chat-bubble chat-bubble-user max-w-[80%] text-[14px]">
                Hey — how does this look?
              </div>
            </div>
            <div className="flex justify-start">
              <div className="chat-bubble chat-bubble-ai max-w-[80%] text-[14px]">
                Sharp and clean. Let's tune the details.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <SectionTitle title="Colors" sub="Pick any color, paste a hex, or use a preset." />

        <div className="grid gap-2 sm:grid-cols-2">
          {COLOR_FIELDS.map((f) => {
            const value = appearance[f.key];
            const hex = toHex(value);
            const isActive = activeField === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveField(f.key)}
                className={cn(
                  "glass flex items-center gap-3 rounded-2xl p-3 text-left transition",
                  isActive && "ring-2 ring-foreground/40",
                )}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-full border border-foreground/15"
                  style={{ background: value }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-muted-foreground truncate text-[11px] font-mono">
                    {hex}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Picker for active field */}
        <div className="mt-4 rounded-2xl border border-foreground/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">
              Editing: {COLOR_FIELDS.find((f) => f.key === activeField)?.label}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={toHex(appearance[activeField])}
                onChange={(e) => update(activeField, e.target.value)}
                className="h-9 w-9 cursor-pointer rounded-full border border-foreground/15 bg-transparent"
                aria-label="Color wheel"
              />
              <input
                type="text"
                value={appearance[activeField]}
                onChange={(e) => update(activeField, e.target.value)}
                className="glass w-36 rounded-full bg-transparent px-3 py-1.5 text-[12px] font-mono outline-none"
                placeholder="#000000 or rgba()"
              />
            </div>
          </div>

          <div className="space-y-3">
            {PRESET_GROUPS.map((g) => (
              <div key={g.group}>
                <div className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase tracking-wide">
                  {g.group}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.swatches.map((s) => (
                    <button
                      key={s.name}
                      title={s.name}
                      onClick={() => update(activeField, s.color)}
                      className="h-7 w-7 rounded-full border border-foreground/15 transition hover:scale-110"
                      style={{ background: s.color }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced controls */}
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <SectionTitle title="Shape & motion" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Slider
            label="Corner radius"
            value={appearance.radius}
            min={0}
            max={32}
            unit="px"
            onChange={(v) => update("radius", v)}
          />
          <Slider
            label="Border thickness"
            value={appearance.borderWidth}
            min={0}
            max={4}
            unit="px"
            onChange={(v) => update("borderWidth", v)}
          />
          <Slider
            label="Bubble opacity"
            value={Math.round(appearance.opacity * 100)}
            min={20}
            max={100}
            unit="%"
            onChange={(v) => update("opacity", v / 100)}
          />
          <Slider
            label="Animation intensity"
            value={appearance.animationIntensity}
            min={0}
            max={100}
            unit=""
            onChange={(v) => update("animationIntensity", v)}
            disabled={appearance.animation === "none"}
          />

          <Segmented<BubbleSize>
            label="Bubble size"
            value={appearance.size}
            options={[
              { value: "compact", label: "Compact" },
              { value: "default", label: "Default" },
              { value: "comfortable", label: "Comfortable" },
            ]}
            onChange={(v) => update("size", v)}
          />

          <Segmented<AnimationMode>
            label="Animation"
            value={appearance.animation}
            options={[
              { value: "minimal", label: "Minimal" },
              { value: "none", label: "None" },
            ]}
            onChange={(v) => update("animation", v)}
          />

          <Toggle
            label="Gradient bubbles"
            checked={appearance.gradient}
            onChange={(v) => update("gradient", v)}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => {
              reset();
              toast.success("Reset to default");
            }}
            className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to default
          </button>
        </div>
      </div>

      {/* Custom themes */}
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <SectionTitle title="Custom themes" sub="Save your current look and switch between styles." />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Theme name"
            className="glass flex-1 min-w-[140px] rounded-full bg-transparent px-4 py-2 text-sm outline-none"
          />
          <button
            onClick={() => {
              if (!newName.trim()) return toast.error("Name your theme first");
              saveTheme(newName);
              setNewName("");
              toast.success("Theme saved");
            }}
            className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Save
          </button>
          <button
            onClick={() => {
              const blob = new Blob([exportThemes()], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "open-intelligence-chat-themes.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="application/json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                importThemes(await f.text());
                toast.success("Themes imported");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Import failed");
              }
              e.target.value = "";
            }}
          />
        </div>

        {themes.length === 0 ? (
          <div className="text-muted-foreground text-sm">No saved themes yet.</div>
        ) : (
          <ul className="space-y-2">
            {themes.map((t) => (
              <li key={t.id} className="glass flex items-center gap-2 rounded-2xl p-2.5">
                <div className="flex shrink-0 gap-1">
                  <span
                    className="h-6 w-6 rounded-full border border-foreground/10"
                    style={{ background: t.appearance.userBg }}
                  />
                  <span
                    className="h-6 w-6 rounded-full border border-foreground/10"
                    style={{ background: t.appearance.aiBg }}
                  />
                </div>
                {renamingId === t.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => {
                      renameTheme(t.id, renameValue.trim() || t.name);
                      setRenamingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        renameTheme(t.id, renameValue.trim() || t.name);
                        setRenamingId(null);
                      }
                    }}
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                ) : (
                  <span className="flex-1 truncate text-sm font-medium">{t.name}</span>
                )}
                <button
                  onClick={() => {
                    applyTheme(t.id);
                    toast.success(`Applied "${t.name}"`);
                  }}
                  className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium"
                >
                  Apply
                </button>
                <IconBtn
                  label="Rename"
                  onClick={() => {
                    setRenamingId(t.id);
                    setRenameValue(t.name);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn label="Duplicate" onClick={() => duplicateTheme(t.id)}>
                  <CopyIcon className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn label="Delete" onClick={() => deleteTheme(t.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>
      {sub && <p className="text-muted-foreground mt-1 text-sm">{sub}</p>}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn("block", disabled && "opacity-50")}>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground font-mono">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-foreground"
      />
    </label>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium">{label}</div>
      <div className="glass inline-flex rounded-full p-1">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              value === o.value
                ? "bg-foreground text-background"
                : "text-muted-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs font-medium">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-foreground" : "bg-foreground/20",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background transition",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="hover:bg-foreground/10 text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full transition"
    >
      {children}
    </button>
  );
}
