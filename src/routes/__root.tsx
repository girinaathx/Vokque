import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { logoUrl } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import i18n from "@/lib/i18n";

const SITE_URL = "https://feyncloud.lovable.app";

const documentBootScript = `(function(){try{document.documentElement.style.colorScheme='light';var l=localStorage.getItem('avenxa:lang');if(l){document.documentElement.lang=l;if(l==='ar'||l==='ur')document.documentElement.dir='rtl';}}catch(e){}})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass-strong animate-glass-pop max-w-md rounded-3xl p-10 text-center">
        <h1 className="text-6xl font-semibold tracking-tight">404</h1>
        <p className="mt-3 text-base text-muted-foreground">
          This page drifted somewhere else.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass-strong max-w-md rounded-3xl p-10 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Something flickered
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again or head home.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
          <a
            href="/"
            className="glass rounded-full px-5 py-2 text-sm font-medium"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
        },
        { title: "Vokque — Your Everyday AI" },
        {
          name: "description",
          content:
            "Vokque is a premium AI assistant for study, work, and everyday life — built by Vokque Technology.",
        },
        { name: "theme-color", content: "#fcf9f6" },
        {
          property: "og:title",
          content: "Vokque — Your Everyday AI",
        },
        {
          property: "og:description",
          content:
            "A premium AI assistant for study, work, and everyday life.",
        },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Vokque" },
        { property: "og:image", content: `${SITE_URL}${logoUrl}` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: `${SITE_URL}${logoUrl}` },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", type: "image/png", href: "/favicon.png" },
        { rel: "apple-touch-icon", href: "/favicon.png" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap",
        },
        {
          rel: "stylesheet",
          href: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css",
          crossOrigin: "anonymous",
        },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                name: "Vokque",
                url: `${SITE_URL}/`,
                description:
                  "Vokque is a premium AI assistant for study, work, and everyday life.",
                publisher: { "@id": `${SITE_URL}/#organization` },
              },
              {
                "@type": "Organization",
                "@id": `${SITE_URL}/#organization`,
                name: "Vokque Technology",
                url: `${SITE_URL}/`,
                logo: `${SITE_URL}${logoUrl}`,
              },
            ],
          }),
        },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
);

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ colorScheme: "light" }}>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: documentBootScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED"
      )
        return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster position="top-center" />
      </QueryClientProvider>
    </I18nextProvider>
  );
}
