import { getClientIp } from "./rate-limit";

export function buildFingerprint(req: Request): string {
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent") ?? "unknown";
  // Simple hash: combine IP + user-agent
  let hash = 0;
  const str = `${ip}|${ua}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}
