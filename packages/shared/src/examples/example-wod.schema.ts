import { z } from 'zod';
import { WodSchema } from '../wod.schema.js';

export const ExampleWodSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(120),
  rawText: z.string().min(1).max(2000),
  card: WodSchema,
});
export type ExampleWod = z.infer<typeof ExampleWodSchema>;
