import { z } from 'zod';
import { LoadUnitSchema, QuantityUnitSchema } from './units.js';

export const CURRENT_WOD_SCHEMA_VERSION = 1;

export const LoadSchema = z.object({
  value: z.number().positive().max(1000),
  unit: LoadUnitSchema,
});
export type Load = z.infer<typeof LoadSchema>;

export const MovementSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  quantity: z.number().int().positive().max(100000).nullable(),
  unit: QuantityUnitSchema.nullable(),
  // Never collapse alternatives like "40/30 kg" into one value, and never
  // pick a default: null when there is no load, otherwise 1+ alternatives.
  loads: z.array(LoadSchema).min(1).max(6).nullable(),
  originalTextSnippet: z.string().min(1).max(200),
});
export type Movement = z.infer<typeof MovementSchema>;

export const ExplanationSchema = z.object({
  abbreviation: z.string().min(1).max(20),
  definition: z.string().min(1).max(300),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

export const IssueSchema = z.object({
  field: z.string().min(1).max(100),
  message: z.string().min(1).max(300),
});
export type Issue = z.infer<typeof IssueSchema>;

export const WodSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    format: z.enum(['amrap', 'for_time']),
    durationSeconds: z.number().int().positive().max(3600).nullable(),
    rounds: z.number().int().positive().max(1000).nullable(),
    timeCapSeconds: z.number().int().positive().max(7200).nullable(),
    movements: z.array(MovementSchema).min(1).max(10),
    explanations: z.array(ExplanationSchema).max(20),
    issues: z.array(IssueSchema).max(20),
  })
  .superRefine((wod, ctx) => {
    // durationSeconds is an AMRAP-only concept; rounds/timeCapSeconds are
    // For Time-only (spec §7) — a card mixing both shapes is contradictory.
    if (wod.format === 'amrap') {
      if (wod.rounds !== null) {
        ctx.addIssue({ code: 'custom', path: ['rounds'], message: 'rounds only applies to for_time workouts' });
      }
      if (wod.timeCapSeconds !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['timeCapSeconds'],
          message: 'timeCapSeconds only applies to for_time workouts',
        });
      }
    } else if (wod.format === 'for_time' && wod.durationSeconds !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationSeconds'],
        message: 'durationSeconds only applies to amrap workouts',
      });
    }

    const ids = wod.movements.map((movement) => movement.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['movements'],
        message: `movement ids must be unique; duplicated: ${[...new Set(duplicates)].join(', ')}`,
      });
    }
  });
export type Wod = z.infer<typeof WodSchema>;
