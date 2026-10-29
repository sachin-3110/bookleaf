"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiClientError } from "@/lib/api-client";
import { login } from "@/lib/endpoints";

/**
 * Login screen. Posts to the API, then sends the browser to `/`, which routes
 * by role. Errors surface inline; we never say whether the email or password
 * was wrong (the API does not either).
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ email, password });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center px-6 py-20">
        <header className="rise">
          <p className="text-[10px] uppercase tracking-[0.18em] text-faint">
            BookLeaf Publishing
          </p>
          <h1 className="font-display mt-3 text-[32px] text-ink">
            Author Support Portal
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Track your books and royalties, and raise support queries with the
            BookLeaf team.
          </p>
        </header>

        <form onSubmit={onSubmit} className="rise mt-9 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="field"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@email.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="field"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md px-3 py-2 text-[12px] bg-danger-bg text-danger-fg"
            >
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="hairline-t mt-10 pt-5 text-[12px] leading-relaxed text-muted">
          <p className="text-[10px] uppercase tracking-[0.16em] text-faint">
            Demo accounts
          </p>
          <dl className="mt-2.5 space-y-1.5">
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-faint">Admin</dt>
              <dd className="font-mono text-[11px] text-ink-soft">
                admin@bookleaf.test / bookleaf123
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-faint">Author</dt>
              <dd className="font-mono text-[11px] text-ink-soft">
                priya.sharma@email.com / bookleaf123
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
