import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Consistent top spacing for every page so titles never sit behind the
 * fixed app header (logo + menu / new-chat buttons).
 */
export const APP_HEADER_HEIGHT = 56;
export const PAGE_TOP_PADDING = `calc(env(safe-area-inset-top, 0px) + ${APP_HEADER_HEIGHT + 12}px)`;

/**
 * Shared page container: equal top padding on every screen.
 */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mx-auto w-full px-5 pb-32", className ?? "max-w-3xl")}
      style={{ paddingTop: PAGE_TOP_PADDING }}
    >
      {children}
    </div>
  );
}

/**
 * Page title block. The Avenxa logo lives in the fixed app header, so it is
 * never pushed down by page content.
 */
export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="animate-fade-up flex flex-col items-center text-center">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h1>
      {subtitle && (
        <p className="text-muted-foreground mt-1.5 max-w-md text-sm">{subtitle}</p>
      )}
    </header>
  );
}

