import { z } from "zod";

export const createRatingSchema = z.object({
  stars: z.number().int().min(1).max(5),
  review: z.string().max(500).optional(),
});

export type CreateRatingInput = z.infer<typeof createRatingSchema>;
