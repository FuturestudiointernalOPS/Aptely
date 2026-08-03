import { z } from "zod";

export const submitReflectionSchema = z.object({
  overall_rating:      z.number().int().min(1).max(5),
  strengths_displayed: z.string().max(2000).optional(),
  areas_to_improve:    z.string().max(2000).optional(),
  key_takeaways:       z.string().max(2000).optional(),
  follow_up_actions:   z.string().max(2000).optional(),
});

export type SubmitReflectionInput = z.infer<typeof submitReflectionSchema>;
