import { z } from "zod";

const safeEventSchema = z
  .object({
    correlationId: z.string().uuid(),
    actionCode: z.string().regex(/^[a-z][a-z0-9_.]{2,79}$/),
    result: z.enum(["success", "denied", "failure"]),
    occurredAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/)
      .refine((value) => !Number.isNaN(Date.parse(value))),
    entityId: z.string().uuid().optional(),
  })
  .strict();

export type SafeApplicationEvent = z.infer<typeof safeEventSchema>;

export type SafeEventResult =
  | { success: true; event: SafeApplicationEvent }
  | { success: false };

export function createSafeEvent(input: unknown): SafeEventResult {
  const parsed = safeEventSchema.safeParse(input);
  return parsed.success
    ? { success: true, event: parsed.data }
    : { success: false };
}
