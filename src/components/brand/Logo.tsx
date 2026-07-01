import logoAsset from "@/assets/feyncloud-logo.jpg.asset.json";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

export function Logo({ className, size = 40, glow = false }: LogoProps) {
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div
          className="absolute inset-0 animate-pulse-glow rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.35), rgba(255,255,255,0.15) 60%, transparent 75%)",
          }}
          aria-hidden
        />
      )}
      {/* Logo is white "h" on black. In Pure White mode we invert to black on white. */}
      <img
        src={logoAsset.url}
        alt="FeynCloud"
        width={size}
        height={size}
        className="relative h-full w-full rounded-[22%] object-cover invert dark:invert-0"
        draggable={false}
      />
    </div>
  );
}

export const logoUrl = logoAsset.url;
