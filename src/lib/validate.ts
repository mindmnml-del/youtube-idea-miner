import { z } from "zod";

const youtubeUrlRegex =
  /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}/;

export const checkoutSchema = z.object({
  videoUrl: z
    .string()
    .min(1, "Video URL is required")
    .regex(youtubeUrlRegex, "Must be a valid YouTube video URL"),
});

export const scanSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  videoUrl: z
    .string()
    .min(1, "Video URL is required")
    .regex(youtubeUrlRegex, "Must be a valid YouTube video URL"),
});

export const verifySchema = z.object({
  session_id: z.string().min(1, "session_id is required"),
});

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((e) => e.message).join(", ");
}
