import { z } from "zod";

export const askAssistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});
