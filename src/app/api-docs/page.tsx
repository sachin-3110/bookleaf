import type { Metadata } from "next";
import Link from "next/link";
import { SwaggerView } from "./swagger-view";

export const metadata: Metadata = {
  title: "BookLeaf API — Reference",
  description:
    "OpenAPI reference for the BookLeaf Author Support Portal: auth, author and admin endpoints.",
};

/**
 * Public API reference. Deliberately outside the `(author)`/`(admin)` route
 * groups — the specification is documentation, not an account-scoped screen.
 */
export default function ApiDocsPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="hairline-b bg-canvas">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-6">
          <div className="flex items-baseline gap-2.5">
            <Link href="/" className="font-display text-[15px] tracking-tight">
              BookLeaf
            </Link>
            <span className="text-[10px] uppercase tracking-[0.16em] text-faint">
              API Reference
            </span>
          </div>
          <nav className="ml-auto flex items-center gap-1 text-[12.5px]">
            <a className="btn btn-ghost" href="/openapi.yaml">
              openapi.yaml
            </a>
            <Link className="btn btn-ghost" href="/login">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="mb-6 max-w-[70ch]">
          <h1 className="font-display text-[24px] text-ink">API reference</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Every endpoint, with request and response shapes, status codes and the
            reasoning behind the non-obvious ones. Authentication is an{" "}
            <span className="text-ink-soft">httpOnly session cookie</span> rather
            than a bearer token, so &ldquo;Try it out&rdquo; works exactly as far as
            this browser is signed in — sign in at{" "}
            <Link href="/login" className="text-ink underline decoration-line-strong underline-offset-2">
              /login
            </Link>{" "}
            first, then return here.
          </p>
        </div>

        <SwaggerView />
      </main>
    </div>
  );
}
