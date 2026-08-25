import { z } from "zod";

export const householdInviteSchema = z.object({
  inviteeEmail: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export type HouseholdInviteInput = z.infer<typeof householdInviteSchema>;
