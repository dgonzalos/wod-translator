import { z } from 'zod';

export const AdaptationProposalSchema = z.object({
  movementId: z.string().min(1).max(50),
  substitute: z.string().min(1).max(100),
  requiredEquipment: z.array(z.string().min(1).max(60)).max(10),
  reason: z.string().min(1).max(300),
  caveats: z.string().max(300).nullable(),
});
export type AdaptationProposal = z.infer<typeof AdaptationProposalSchema>;

export const EquipmentSelectionSchema = z.object({
  equipment: z.array(z.string().min(1).max(60)).max(30),
  availableLoadsKg: z.array(z.number().positive().max(1000)).max(20).nullable(),
});
export type EquipmentSelection = z.infer<typeof EquipmentSelectionSchema>;
