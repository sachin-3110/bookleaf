"use client";

import { useEffect, useRef, useState } from "react";

const SWAGGER_CSS = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
const SWAGGER_JS = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";

declare global {
  interface Window {
    SwaggerUIBundle?: (config: Record<string, unknown>) => unknown;
  }
}

/**
 * Swagger UI, loaded from a CDN.
 *
 * The alternative was `swagger-ui-react`, which drags a large React-version-
 * sensitive tree into the bundle for a page that is, in practice, a static
 * viewer. Loading the prebuilt bundle from a CDN keeps the dependency tree at
 * zero and the spec itself is served same-origin from `/openapi.yaml`.
 *
 * Because auth is an httpOnly cookie, "Try it out" works exactly as far as the
 * browser is signed in — there is nothing to paste.
 */
export function SwaggerView() {
  const mounted = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    function boot() {
      if (!window.SwaggerUIBundle) {
        setStatus("error");
        return;
      }
      window.SwaggerUIBundle({
        url: "/openapi.yaml",
        dom_id: "#swagger-ui",
        deepLinking: true,
        docExpansion: "list",
        defaultModelsExpandDepth: 1,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      });
      setStatus("ready");
    }

    if (!document.querySelector(`link[href="${SWAGGER_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = SWAGGER_CSS;
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SWAGGER_JS}"]`,
    );
    if (existing) {
      if (window.SwaggerUIBundle) boot();
      else existing.addEventListener("load", boot);
      return;
    }

    const script = document.createElement("script");
    script.src = SWAGGER_JS;
    script.async = true;
    script.addEventListener("load", boot);
    script.addEventListener("error", () => setStatus("error"));
    document.body.appendChild(script);
  }, []);

  return (
    <div>
      {status === "loading" ? (
        <p className="py-10 text-center text-[13px] text-muted">
          Loading API reference…
        </p>
      ) : null}

      {status === "error" ? (
        <div className="card px-5 py-5">
          <p className="text-[14px] text-ink">
            The API reference viewer could not load.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            It renders from a CDN, so it needs network access. The specification
            itself is served locally and can be opened or imported directly:
          </p>
          <a className="btn btn-secondary mt-4" href="/openapi.yaml">
            Open /openapi.yaml
          </a>
        </div>
      ) : null}

      <div id="swagger-ui" />
    </div>
  );
}
