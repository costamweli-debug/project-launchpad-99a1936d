// Client-side analytics: Google Analytics 4 (gtag.js) + Microsoft Clarity.
// All functions are safe to call during SSR — they no-op when window is absent.

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
    __exampass_analytics_initialized?: boolean;
  }
}

const isBrowser = () => typeof window !== "undefined";

const isProdHost = () => {
  if (!isBrowser()) return false;
  const host = window.location.hostname;
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return false;
  if (host.endsWith(".local")) return false;
  return true;
};

export function initAnalytics(): void {
  if (!isBrowser()) return;
  if (window.__exampass_analytics_initialized) return;
  if (!isProdHost()) return;
  if (!import.meta.env.PROD) return;

  window.__exampass_analytics_initialized = true;

  const ga4Id = import.meta.env.VITE_GA4_ID as string | undefined;
  const clarityId = import.meta.env.VITE_CLARITY_ID as string | undefined;

  // GA4 / gtag.js
  if (ga4Id) {
    window.dataLayer = window.dataLayer || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gtag: (...args: any[]) => void = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag = gtag;
    gtag("js", new Date());
    // SPA: disable auto page_view so we can send manually on route change.
    gtag("config", ga4Id, { send_page_view: false });

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`;
    document.head.appendChild(s);
  }

  // Microsoft Clarity
  if (clarityId) {
    (function (c: Window, l: Document, a: string, r: string, i: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c as any)[a] =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any)[a] ||
        function () {
          // eslint-disable-next-line prefer-rest-params, @typescript-eslint/no-explicit-any
          ((c as any)[a].q = (c as any)[a].q || []).push(arguments);
        };
      const t = l.createElement(r) as HTMLScriptElement;
      t.async = true;
      t.src = "https://www.clarity.ms/tag/" + i;
      const y = l.getElementsByTagName(r)[0];
      y.parentNode?.insertBefore(t, y);
    })(window, document, "clarity", "script", clarityId);
  }
}

export function trackPageView(path: string): void {
  if (!isBrowser()) return;
  const ga4Id = import.meta.env.VITE_GA4_ID as string | undefined;
  if (!ga4Id) return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", "page_view", {
        page_path: path,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  } catch {
    // no-op
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!isBrowser()) return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    } else {
      // Queue by pushing to dataLayer directly; gtag will pick it up once loaded.
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(["event", name, params || {}]);
    }
  } catch {
    // no-op
  }
}
