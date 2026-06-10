import logoAsset from "@/assets/open-intelligence-logo.png.asset.json";
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
              "radial-gradient(circle, rgba(120,180,255,0.55), rgba(255,180,200,0.35) 60%, transparent 75%)",
          }}
          aria-hidden
        />
      )}
      <img
        src={logoAsset.url}
        alt="Open Intelligence"
        width={size}
        height={size}
        className="relative h-full w-full object-contain"
        draggable={false}
      />
    </div>
  );
}

export const logoUrl = logoAsset.url;
