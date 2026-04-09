import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { validateEnv } from "@/lib/env";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import { checkoutSchema, formatZodError } from "@/lib/validate";
import { buildFingerprint } from "@/lib/fingerprint";
import { logger } from "@/lib/logger";

validateEnv();

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getBaseUrl(req: NextRequest) {
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  if (isRateLimited(`checkout:${ip}`, 5)) {
    logger.warn("Rate limited checkout", { ip });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const { videoUrl } = parsed.data;
    const fingerprint = buildFingerprint(req);
    const baseUrl = getBaseUrl(req);

    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}&video_url=${encodeURIComponent(videoUrl)}`,
      cancel_url: `${baseUrl}/?canceled=true`,
      metadata: { videoUrl, fingerprint },
    });

    logger.info("Checkout session created", {
      sessionId: session.id,
      ip,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Checkout error", { error: message, ip });
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
