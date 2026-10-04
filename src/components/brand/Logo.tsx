import logoUrl from "@/assets/avenxa-mark.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

/** Existing Vokque mark; preserve its shape on both surfaces. */
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
        className="relative h-full w-full object-contain brightness-0 dark:brightness-0 dark:invert"
        draggable={false}
      />
    </div>
  );
}

export { logoUrl };
