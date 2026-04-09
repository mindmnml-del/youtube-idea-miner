import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getBaseUrl(req: NextRequest) {
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const { videoUrl } = await req.json();

    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json({ error: "Video URL is required" }, { status: 400 });
    }

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
      metadata: { videoUrl },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
