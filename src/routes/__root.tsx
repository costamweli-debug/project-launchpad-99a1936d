import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Toaster } from "sonner";
import logoSvg from "@/assets/exampass-logo.svg?raw";
import { initAnalytics, trackPageView } from "@/lib/analytics";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold" style={{ color: "var(--color-foreground)", fontFamily: "var(--font-display)" }}>404</h1>
        <h2 className="mt-4 text-xl font-semibold" style={{ color: "var(--color-foreground)" }}>Page not found</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          >
            Go home
          </Link>
        </div>
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
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--color-foreground)" }}>
          This page didn't load
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-foreground)" }}
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ExamPass AI — Pass NSSCO & AS Level with AI" },
      { name: "description", content: "AI-powered exam prep for Namibian students. Generate quizzes, get instant explanations, and track progress for NSSCO & AS Level. Study smarter, pass with confidence." },
      { name: "author", content: "ExamPass AI" },
      { property: "og:title", content: "ExamPass AI — Pass NSSCO & AS Level with AI" },
      { property: "og:description", content: "AI-powered exam prep for Namibian students. Generate quizzes, get instant explanations, and track progress for NSSCO & AS Level. Study smarter, pass with confidence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "ExamPass AI — Pass NSSCO & AS Level with AI" },
      { name: "twitter:description", content: "AI-powered exam prep for Namibian students. Generate quizzes, get instant explanations, and track progress for NSSCO & AS Level. Study smarter, pass with confidence." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7624babf-0d43-49a0-ba82-d3ca427a44d1/id-preview-c6fa47af--9ef0c253-6aa5-46f0-a0c0-0ac31cdd4658.lovable.app-1780649579370.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7624babf-0d43-49a0-ba82-d3ca427a44d1/id-preview-c6fa47af--9ef0c253-6aa5-46f0-a0c0-0ac31cdd4658.lovable.app-1780649579370.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AppNav({ user }: { user: { email?: string } | null }) {
  const navigate = useNavigate();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/", replace: true });
  };

  const navLinks: { to: "/dashboard" | "/chat" | "/progress" | "/rank" | "/pdf"; label: string; accent?: boolean }[] = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/chat", label: "Chat", accent: true },
    { to: "/progress", label: "Progress" },
    { to: "/rank", label: "Rank" },
    { to: "/pdf", label: "PDF" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b backdrop-blur-md" style={{ borderColor: "var(--color-border)", backgroundColor: "color-mix(in oklab, var(--color-background) 80%, transparent)" }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5 leading-none" onClick={() => setMenuOpen(false)}>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center [&_svg]:h-full [&_svg]:w-full [&_svg]:block" dangerouslySetInnerHTML={{ __html: logoSvg }} />
          <span className="text-lg font-bold leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--color-primary)" }}>ExamPass AI</span>
        </Link>

        {user ? (
          <>
            {/* Desktop nav */}
            <div className="hidden items-center gap-3 md:flex">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: l.accent ? "var(--color-mint)" : "var(--color-foreground)" }}
                >
                  {l.label}
                </Link>
              ))}
              <ThemeToggle />
              <button
                onClick={handleSignOut}
                className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: "var(--color-surface)", color: "var(--color-foreground)" }}
              >
                Sign Out
              </button>
            </div>

            {/* Mobile trigger */}
            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle />
              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)", backgroundColor: "var(--color-surface)" }}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/auth"
              className="rounded-md px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
            >
              Get Started
            </Link>
          </div>
        )}
      </div>

      {/* Mobile dropdown */}
      {user && menuOpen && (
        <div
          className="border-t md:hidden"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-background)" }}
        >
          <div className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: l.accent ? "var(--color-mint)" : "var(--color-foreground)" }}
              >
                {l.label}
              </Link>
            ))}
            <button
              onClick={handleSignOut}
              className="mt-1 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--color-surface)", color: "var(--color-foreground)" }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [user, setUser] = useState<{ email?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { email: data.user.email || undefined } : null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        setUser(session?.user ? { email: session.user.email || undefined } : null);
        queryClient.invalidateQueries();
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--color-background)", color: "var(--color-foreground)" }}>
          <AppNav user={user} />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
