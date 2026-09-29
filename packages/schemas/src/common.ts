import { z } from 'zod';

export const veriStatusValues = [
  'Verified',
  'Pending_AI',
  'Flagged_Location',
  'Failed_C2PA',
] as const;

export const tempoPhaseValues = ['Baseline_Before', 'Interim_Work', 'Outcome_After'] as const;

export const veriStatusSchema = z.enum(veriStatusValues);
export type VeriStatus = z.infer<typeof veriStatusSchema>;

export const tempoPhaseSchema = z.enum(tempoPhaseValues);
export type TempoPhase = z.infer<typeof tempoPhaseSchema>;

const latLongPattern =
  '^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?),\\s*[-+]?(180(\\.0+)?|((1[0-7]\\d)|(\\d{1,2}))(\\.\\d+)?)$';

export const geoCoordsSchema = z
  .string()
  .regex(new RegExp(latLongPattern), 'must be lat, long like 12.97, 77.59');

export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, 'must be sha256 hex');

export const projectIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'only letters, numbers, dash and underscore');

export const publicIdSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9_/-]+$/, 'bad public id');
