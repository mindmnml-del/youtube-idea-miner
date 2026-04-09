import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ApifyClient } from "apify-client";

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

export async function POST(req: NextRequest) {
  try {
    const { sessionId, videoUrl } = await req.json();

    if (!sessionId || !videoUrl) {
      return NextResponse.json({ error: "Missing sessionId or videoUrl" }, { status: 400 });
    }

    // Verify payment
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 403 });
    }

    // Run Apify YouTube Comment Scraper
    const apify = getApify();
    const run = await apify.actor("apify/youtube-comment-scraper").call({
      startUrls: [{ url: videoUrl }],
      maxComments: 300,
      maxReplies: 0,
    });

    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    const ideas = extractIdeas(items as ApifyComment[]);

    return NextResponse.json({ ideas, totalComments: items.length });
  } catch (err) {
    console.error("Scan error:", err);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}
