import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ApifyClient } from "apify-client";
import { validateEnv } from "@/lib/env";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import { scanSchema, formatZodError } from "@/lib/validate";
import { buildFingerprint } from "@/lib/fingerprint";
import { isSessionConsumed, markSessionConsumed } from "@/lib/sessions";
import { logger } from "@/lib/logger";

validateEnv();

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getApify() {
  return new ApifyClient({ token: process.env.APIFY_API_TOKEN! });
}

interface ApifyComment {
  text?: string;
  likesCount?: number;
  replyCount?: number;
  author?: string;
}

interface ContentIdea {
  idea: string;
  source: string;
  likes: number;
  replies: number;
  category: string;
}

function extractIdeas(comments: ApifyComment[]): ContentIdea[] {
  const questionPatterns = [
    /how (?:do|can|to|does|should)/i,
    /what (?:is|are|if|about|would)/i,
    /why (?:do|does|is|are|did|would)/i,
    /can (?:you|someone|anyone)/i,
    /is there (?:a|any)/i,
    /where (?:can|do|is)/i,
    /\?/,
  ];

  const requestPatterns = [
    /please (?:make|do|create|cover|explain|show)/i,
    /(?:video|tutorial|guide) (?:on|about|for)/i,
    /would love (?:to see|a)/i,
    /you should (?:make|do|cover|try)/i,
    /can you (?:make|do|cover|explain)/i,
    /wish (?:you|there)/i,
    /need (?:a|more|help)/i,
  ];

  const painPatterns = [
    /(?:struggle|struggling|difficult|hard|confusing|confused|frustrated)/i,
    /(?:doesn't|doesn't|won't|can't|cannot) work/i,
    /(?:problem|issue|bug|error) with/i,
    /(?:hate|annoying|terrible|worst|bad) /i,
  ];

  const ideas: ContentIdea[] = [];
  const seen = new Set<string>();

  for (const comment of comments) {
    const text = comment.text?.trim();
    if (!text || text.length < 15 || text.length > 500) continue;

    const normalized = text.toLowerCase().slice(0, 80);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    let category = "";
    if (requestPatterns.some((p) => p.test(text))) {
      category = "Content Request";
    } else if (questionPatterns.some((p) => p.test(text))) {
      category = "Question";
    } else if (painPatterns.some((p) => p.test(text))) {
      category = "Pain Point";
    }

    if (category) {
      ideas.push({
        idea: text.slice(0, 200),
        source: comment.author ?? "Anonymous",
        likes: comment.likesCount ?? 0,
        replies: comment.replyCount ?? 0,
        category,
      });
    }
  }

  return ideas
    .sort((a, b) => b.likes + b.replies * 2 - (a.likes + a.replies * 2))
    .slice(0, 100);
}

const APIFY_TIMEOUT_MS = 120_000; // 2 minutes

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  if (isRateLimited(`scan:${ip}`, 3)) {
    logger.warn("Rate limited scan", { ip });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = scanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const { sessionId, videoUrl } = parsed.data;

    // Prevent session reuse
    if (isSessionConsumed(sessionId)) {
      logger.warn("Attempted session reuse", { sessionId, ip });
      return NextResponse.json(
        { error: "This scan session has already been used" },
        { status: 403 }
      );
    }

    // Verify payment
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 403 }
      );
    }

    // Verify fingerprint matches checkout
    const expectedFingerprint = session.metadata?.fingerprint;
    const currentFingerprint = buildFingerprint(req);
    if (expectedFingerprint && expectedFingerprint !== currentFingerprint) {
      logger.warn("Fingerprint mismatch on scan", {
        sessionId,
        ip,
      });
      return NextResponse.json(
        { error: "Session mismatch" },
        { status: 403 }
      );
    }

    // Mark session consumed before running the expensive Apify call
    markSessionConsumed(sessionId);

    // Run Apify YouTube Comment Scraper with timeout
    const apify = getApify();
    const runPromise = apify.actor("apify/youtube-comment-scraper").call({
      startUrls: [{ url: videoUrl }],
      maxComments: 300,
      maxReplies: 0,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Apify request timed out")), APIFY_TIMEOUT_MS)
    );

    const run = await Promise.race([runPromise, timeoutPromise]);
    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    const ideas = extractIdeas(items as ApifyComment[]);

    logger.info("Scan completed", {
      sessionId,
      totalComments: items.length,
      ideasFound: ideas.length,
      ip,
    });

    return NextResponse.json({ ideas, totalComments: items.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Scan error", { error: message, ip });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
