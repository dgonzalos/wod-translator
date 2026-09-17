import { z } from 'zod';

export const QUANTITY_UNITS = ['reps', 'm', 'cal', 'sec'] as const;
export const QuantityUnitSchema = z.enum(QUANTITY_UNITS);
export type QuantityUnit = z.infer<typeof QuantityUnitSchema>;

export const LOAD_UNITS = ['kg', 'lb'] as const;
export const LoadUnitSchema = z.enum(LOAD_UNITS);
export type LoadUnit = z.infer<typeof LoadUnitSchema>;
