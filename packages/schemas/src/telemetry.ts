import { z } from 'zod';

export const infrastructureCategoryValues = [
  'Water Access',
  'Solar Array',
  'Reforestation',
  'Educational Facility',
  'Agricultural Plot',
] as const;

export const operationalStatusValues = [
  'Fully Operational',
  'Under Construction',
  'Damaged',
  'Inoperable',
] as const;

export const waterTelemetrySchema = z
  .object({
    infrastructure_category: z.enum(infrastructureCategoryValues),
    operational_status: z.enum(operationalStatusValues),
    quantitative_unit_count: z.number().int().min(0),
    hazard_present: z.boolean(),
    confidence_rating: z.number().min(0).max(1),
  })
  .strict();

export type WaterTelemetry = z.infer<typeof waterTelemetrySchema>;

export const forestTelemetrySchema = z
  .object({
    infrastructure_category: z.literal('Reforestation'),
    canopy_cover_pct: z.number().min(0).max(100),
    sapling_count: z.number().int().min(0),
    ndvi_delta: z.number().gt(-1).lt(1),
    hazard_present: z.boolean(),
    confidence_rating: z.number().min(0).max(1),
  })
  .strict();

export type ForestTelemetry = z.infer<typeof forestTelemetrySchema>;

export const solarTelemetrySchema = z
  .object({
    infrastructure_category: z.literal('Solar Array'),
    panel_count: z.number().int().min(0),
    soiling_score: z.number().min(0).max(1),
    tilt_anomaly: z.boolean(),
    operational_status: z.enum(operationalStatusValues),
    confidence_rating: z.number().min(0).max(1),
  })
  .strict();

export type SolarTelemetry = z.infer<typeof solarTelemetrySchema>;

export const telemetryBySector = {
  water: waterTelemetrySchema,
  forest: forestTelemetrySchema,
  solar: solarTelemetrySchema,
} as const;

export type SectorName = keyof typeof telemetryBySector;

export function isConfidentEnough(confidence: number): boolean {
  return confidence >= 0.6;
}
