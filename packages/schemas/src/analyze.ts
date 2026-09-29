import type { JSONSchema7 } from './json.js';
import type { SectorName } from './telemetry.js';

export const waterJsonSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    infrastructure_category: {
      type: 'string',
      enum: [
        'Water Access',
        'Solar Array',
        'Reforestation',
        'Educational Facility',
        'Agricultural Plot',
      ],
    },
    operational_status: {
      type: 'string',
      enum: ['Fully Operational', 'Under Construction', 'Damaged', 'Inoperable'],
    },
    quantitative_unit_count: { type: 'integer', minimum: 0 },
    hazard_present: { type: 'boolean' },
    confidence_rating: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: [
    'infrastructure_category',
    'operational_status',
    'quantitative_unit_count',
    'confidence_rating',
  ],
  additionalProperties: false,
};

export const forestJsonSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    infrastructure_category: { type: 'string', const: 'Reforestation' },
    canopy_cover_pct: { type: 'number', minimum: 0, maximum: 100 },
    sapling_count: { type: 'integer', minimum: 0 },
    ndvi_delta: { type: 'number', exclusiveMinimum: -1, exclusiveMaximum: 1 },
    hazard_present: { type: 'boolean' },
    confidence_rating: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['infrastructure_category', 'canopy_cover_pct', 'sapling_count', 'confidence_rating'],
  additionalProperties: false,
};

export const solarJsonSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    infrastructure_category: { type: 'string', const: 'Solar Array' },
    panel_count: { type: 'integer', minimum: 0 },
    soiling_score: { type: 'number', minimum: 0, maximum: 1 },
    tilt_anomaly: { type: 'boolean' },
    operational_status: {
      type: 'string',
      enum: ['Fully Operational', 'Under Construction', 'Damaged', 'Inoperable'],
    },
    confidence_rating: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['infrastructure_category', 'panel_count', 'operational_status', 'confidence_rating'],
  additionalProperties: false,
};

export const jsonSchemaBySector: Record<SectorName, JSONSchema7> = {
  water: waterJsonSchema,
  forest: forestJsonSchema,
  solar: solarJsonSchema,
};

export const sectorPromptBySector: Record<SectorName, string> = {
  water:
    'Analyze this rural infrastructure photo. Check build state, use state, and visible units. Return only JSON that fits the schema.',
  forest:
    'Analyze this planting site photo. Estimate cover, count saplings, and change. Return only JSON that fits the schema.',
  solar:
    'Analyze this solar site photo. Count panels, note dirt and tilt faults, and use state. Return only JSON that fits the schema.',
};
