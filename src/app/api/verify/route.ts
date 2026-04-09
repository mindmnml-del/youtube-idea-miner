import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { validateEnv } from "@/lib/env";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import { verifySchema, formatZodError } from "@/lib/validate";
import { logger } from "@/lib/logger";

validateEnv();

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);

  if (isRateLimited(`verify:${ip}`, 10)) {
    logger.warn("Rate limited verify", { ip });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = verifySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(
      parsed.data.session_id
    );

    if (session.payment_status === "paid") {
      return NextResponse.json({
        paid: true,
        videoUrl: session.metadata?.videoUrl ?? null,
      });
    }

    return NextResponse.json({ paid: false });
  } catch {
    logger.warn("Invalid session lookup", { ip });
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }
}
