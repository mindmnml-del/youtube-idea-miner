const required = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID",
  "APIFY_API_TOKEN",
] as const;

export function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}
