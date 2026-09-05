import logoUrl from "@/assets/avenxa-mark.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

/** Existing Vokque mark, rendered in pure white. Shape unchanged. */
export function Logo({ className, size = 40 }: LogoProps) {
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <img
        src={logoUrl}
        alt="Vokque logo"
        width={size}
        height={size}
        className="relative h-full w-full object-contain"
        draggable={false}
      />
    </div>
  );
}

export { logoUrl };
