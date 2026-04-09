# QA Fixes Log

## Round 1 — Playwright E2E Tests

**Date:** 2026-04-09
**Tests:** 11 total | 6 passed, 5 failed

### Issue: Strict mode violations on generic `locator('button')` and `locator('text=...')`

**Root cause:** Next.js Dev Tools injects an extra `<button id="next-logo">` into the DOM during development. Generic `page.locator("button")` matched both the app button and the Dev Tools button, causing Playwright strict mode violations.

Similarly, `locator("text=Questions")` matched both the feature card heading and a substring in the page description paragraph.

**Fix applied:**
- Replaced `page.locator("button")` with `page.getByRole("button", { name: /Scan Comments/ })` to target the specific pay button
- Replaced `page.locator("text=Questions")` with `page.getByText("Questions", { exact: true })` for precise card matching
- Same pattern for Requests and Pain Points cards

**Result:** 11/11 tests passing (10.3s)

### Tests covered:
1. Landing page UI elements render correctly
2. Invalid YouTube URL shows validation error
3. Button disabled when input empty
4. Button enabled after URL entry
5. Checkout API returns Stripe URL (or 500 with placeholder keys)
6. Checkout API rejects missing videoUrl (400)
7. Verify API rejects missing session_id (400)
8. Verify API rejects invalid session_id (400)
9. Scan API rejects missing params (400)
10. Success page shows loading spinner
11. Pay button shows "Redirecting to checkout" on click
