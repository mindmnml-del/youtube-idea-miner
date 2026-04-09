import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      return NextResponse.json({
        paid: true,
        videoUrl: session.metadata?.videoUrl ?? null,
      });
    }

    return NextResponse.json({ paid: false });
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }
}
