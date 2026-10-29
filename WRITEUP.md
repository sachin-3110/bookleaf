# BookLeaf Author Support Portal — Write-up

## What I prioritised, and why

I read the assignment as two products sharing one backend: **authors need answers and visibility**,
**ops needs to not lose track of anyone**. So I built the thinnest thing that makes both real, then
made it trustworthy.

1. **Data fidelity first.** The seed is the test. I modelled `books` as their own collection
   (rather than only nesting them under authors) because three flows query books independently:
   an author's catalogue, the ticket form's book picker, and the ticket↔book join. In-production
   titles keep their `null`s and are excluded from royalty totals — showing a guessed number next
   to real money is worse than showing nothing.
2. **The queue is the product.** The highest-value screen is the admin queue. It defaults to
   `sort=urgency` — status first, then priority rank, then age — because "most urgent and oldest
   unresolved, easy to spot" is the actual operational need. Everything else supports that screen.
3. **AI that assists without ever blocking.** Three jobs — classify category, score priority, draft
   a reply — all *advisory*. A ticket is never held up by the model: if AI is off, slow (8s) or
   rate-limited, a deterministic rule-based fallback still classifies and drafts, and creation
   returns `201` regardless.
4. **Make the AI's work auditable.** When an admin overrides a classification, the model's original
   guess is preserved in `aiOriginal` and an event is appended. The UI shows "AI originally said X"
   alongside the override — so a reviewer can *see* that the system is honest about what it decided
   versus what a human decided.

## Trade-offs I made deliberately

- **Polling over sockets.** SWR refetches every ~10s. A support inbox changes on human timescales,
  so WebSockets/SSE would add connection state and serverless friction for latency nobody can
  perceive. SSE is the next step if it ever matters — not sockets.
- **Custom JWT in an httpOnly cookie over a session store.** Stateless and XSS-resistant, and it
  keeps RBAC demonstrable. The cost is revocation latency: a token is valid until it expires.
- **404 instead of 403 for other people's resources.** An author requesting a ticket they don't
  own gets `404`, not `403` — a `403` confirms the record exists. Avoiding the leak beats a nicer
  error message.
- **Metadata-only attachments.** The brief requires the UI, not uploads. Storing filenames without
  building a storage pipeline is the honest scope; it's labelled as such in the README.
- **Regex search over Atlas Search.** Fine for 18 books; Atlas Search is the production answer.
- **One combined classify+priority call, lazy cached drafts.** Two enums from one request halves
  latency and cost; drafts are generated only when an admin opens a ticket, so untouched tickets
  cost nothing.

## How I'd productionise it

- **Auth:** short-lived access token + rotating refresh token, or a server-side denylist for real
  revocation; move rate limiting from in-memory to Redis so it works across instances.
- **AI:** keep the provider adapter, add per-model budgets and an override-rate metric — if a
  category is overridden often, that's a prompt/KB problem, and the data to fix it is already
  being recorded.
- **Search & scale:** Atlas Search for `q`, cursor pagination for the queue, and an index review
  under real filter combinations.
- **Attachments:** signed direct-to-object-store uploads with virus scanning, storing only keys.
- **Observability:** structured logs for AI runs (provider, model, tokens, latency, fallback) and
  alerts on fallback rate — a spike means the provider is down or a model was retired.
- **Delivery:** Vercel + Atlas with preview deploys per PR, seed as a one-shot job, and the Postman
  collection wired into CI as an API smoke test.

## With more time

Email notifications on reply (authors currently learn of a reply by polling), an author-facing
ticket timeline, saved queue views for admins, and a small analytics view on first-response time
and override rate.
