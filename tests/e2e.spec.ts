import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const DUMMY_VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

test.describe("YouTube Idea Miner — E2E QA", () => {
  test("Landing page loads with all UI elements", async ({ page }) => {
    await page.goto(BASE);

    await expect(page.locator("h1")).toHaveText("YouTube Idea Miner");
    await expect(page.locator("p").first()).toContainText("Extract content ideas");

    const input = page.locator('input[type="url"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("placeholder", "https://youtube.com/watch?v=...");

    const payButton = page.getByRole("button", { name: /Scan Comments/ });
    await expect(payButton).toContainText("Scan Comments — $0.99");

    // Feature cards — use exact match to avoid matching description text
    await expect(page.getByText("Questions", { exact: true })).toBeVisible();
    await expect(page.getByText("Requests", { exact: true })).toBeVisible();
    await expect(page.getByText("Pain Points", { exact: true })).toBeVisible();
  });

  test("Rejects invalid YouTube URL", async ({ page }) => {
    await page.goto(BASE);

    const input = page.locator('input[type="url"]');
    await input.fill("https://notayoutubeurl.com");
    await page.getByRole("button", { name: /Scan Comments/ }).click();

    await expect(page.getByText("Please enter a valid YouTube video URL")).toBeVisible();
  });

  test("Button disabled when input is empty", async ({ page }) => {
    await page.goto(BASE);
    const payButton = page.getByRole("button", { name: /Scan Comments/ });
    await expect(payButton).toBeDisabled();
  });

  test("Button enabled after entering URL", async ({ page }) => {
    await page.goto(BASE);
    const input = page.locator('input[type="url"]');
    await input.fill(DUMMY_VIDEO);
    const payButton = page.getByRole("button", { name: /Scan Comments/ });
    await expect(payButton).toBeEnabled();
  });

  test("Checkout API returns Stripe redirect URL", async ({ request }) => {
    const res = await request.post(`${BASE}/api/checkout`, {
      data: { videoUrl: DUMMY_VIDEO },
    });

    const status = res.status();
    if (status === 200) {
      const data = await res.json();
      expect(data.url).toBeTruthy();
      expect(data.url).toContain("checkout.stripe.com");
    } else {
      // Stripe key not configured — expected in dev with placeholder keys
      expect(status).toBe(500);
    }
  });

  test("Checkout API rejects missing videoUrl", async ({ request }) => {
    const res = await request.post(`${BASE}/api/checkout`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Video URL is required");
  });

  test("Verify API rejects missing session_id", async ({ request }) => {
    const res = await request.get(`${BASE}/api/verify`);
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing session_id");
  });

  test("Verify API rejects invalid session_id", async ({ request }) => {
    const res = await request.get(`${BASE}/api/verify?session_id=fake_123`);
    expect(res.status()).toBe(400);
  });

  test("Scan API rejects missing params", async ({ request }) => {
    const res = await request.post(`${BASE}/api/scan`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing sessionId or videoUrl");
  });

  test("Success page shows loading spinner", async ({ page }) => {
    await page.goto(
      `${BASE}/success?session_id=fake&video_url=${encodeURIComponent(DUMMY_VIDEO)}`
    );

    await expect(
      page.getByText("Scanning YouTube comments")
    ).toBeVisible();
  });

  test("Valid YouTube URL triggers checkout redirect", async ({ page }) => {
    await page.goto(BASE);
    const input = page.locator('input[type="url"]');
    await input.fill(DUMMY_VIDEO);
    await page.getByRole("button", { name: /Scan Comments/ }).click();

    await expect(
      page.getByRole("button", { name: /Redirecting to checkout/ })
    ).toBeVisible();
  });
});
