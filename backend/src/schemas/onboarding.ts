import { z } from "zod";
import {
  systemProfileSchema,
  storageSchema,
  emailSchema,
  metricsSchema,
  screenscraperSchema,
  personalizationSchema,
} from "../plugins/settings.js";
import { ONBOARDING_STEP_KEYS } from "../services/setup/state.js";

export const adminPayloadSchema = z.object({
  email: z.string().email(),
  nickname: z.string().min(3).max(32),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a digit"),
});

export const stepUpdateSchema = z.object({
  status: z.enum(["COMPLETED", "SKIPPED"]),
  settings: z
    .object({
      systemProfile: systemProfileSchema.partial().optional(),
      storage: storageSchema.partial().optional(),
      email: emailSchema.partial().optional(),
      metrics: metricsSchema.partial().optional(),
      screenscraper: screenscraperSchema.partial().optional(),
      personalization: personalizationSchema.partial().optional(),
    })
    .partial()
    .optional(),
  notes: z.string().max(200).optional(),
});

export const stepParamsSchema = z.object({
  stepKey: z.enum(ONBOARDING_STEP_KEYS),
});

export type StepUpdateSettings = z.infer<typeof stepUpdateSchema>["settings"];
