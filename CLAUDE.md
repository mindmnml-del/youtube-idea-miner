# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Build & Dev Commands

- `npm run dev` — start dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, core-web-vitals + typescript presets)
- `npm start` — serve production build

No test runner is configured yet. Playwright is installed as a dev dependency but has no test files.

## Environment Variables

The app requires these env vars at runtime:
- `STRIPE_SECRET_KEY` — Stripe API key (server-side only)
- `STRIPE_PRICE_ID` — Stripe price ID for the $0.99 scan product
- `APIFY_API_TOKEN` — Apify API token for the YouTube comment scraper

## Architecture

This is a Next.js 16 App Router project (React 19, Tailwind CSS v4, TypeScript). It is a paid micro-tool: users paste a YouTube video URL, pay $0.99 via Stripe Checkout, then the app scrapes comments via Apify and extracts content ideas.

### User Flow

1. **Home page** (`src/app/page.tsx`, client component) — user enters a YouTube URL, clicks pay
2. **POST `/api/checkout`** — creates a Stripe Checkout session with the video URL in metadata, redirects user to Stripe
3. **Success page** (`src/app/success/page.tsx`, client component) — after payment, reads `session_id` and `video_url` from query params, calls `/api/scan`
4. **POST `/api/scan`** — verifies payment via Stripe session, runs Apify's `youtube-comment-scraper` actor (up to 300 comments), extracts ideas using regex-based categorization (Questions, Content Requests, Pain Points), returns sorted results
5. **GET `/api/verify`** — standalone payment verification endpoint (checks Stripe session status)

### Key Design Decisions

- Comment analysis is entirely regex-based (no AI/LLM) — patterns live in `extractIdeas()` inside `src/app/api/scan/route.ts`
- Ideas are scored by `likes + replies * 2`, capped at 100 results
- Stripe client is instantiated per-request via `getStripe()` helper (not a module-level singleton)
- Path alias: `@/*` maps to `./src/*`
