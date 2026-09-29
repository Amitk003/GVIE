export const METADATA_FIELDS = [
  {
    external_id: 'proj_id',
    label: 'Project Identifier',
    type: 'set',
    datasource: 'proj_list',
  },
  {
    external_id: 'veri_status',
    label: 'Verification Status',
    type: 'set',
    datasource: 'veri_list',
  },
  { external_id: 'c2pa_valid', label: 'Cryptographic Provenance', type: 'boolean' },
  { external_id: 'geo_coords', label: 'WGS84 Coordinates', type: 'string' },
  {
    external_id: 'tempo_phase',
    label: 'Chronological Phase',
    type: 'set',
    datasource: 'tempo_list',
  },
  { external_id: 'base_asset_id', label: 'Baseline Public ID', type: 'string' },
  { external_id: 'ndvi_delta', label: 'Vegetation Index Delta', type: 'number' },
  { external_id: 'obj_count', label: 'AI Count Indicator', type: 'number' },
  { external_id: 'iqa_score', label: 'Image Quality Score', type: 'number' },
  { external_id: 'impact_summary', label: 'Impact Summary Text', type: 'string' },
] as const;

export const METADATA_DATASOURCES = {
  proj_list: ['WATER-01', 'FOREST-01', 'SOLAR-01'],
  veri_list: ['Verified', 'Pending_AI', 'Flagged_Location', 'Failed_C2PA'],
  tempo_list: ['Baseline_Before', 'Interim_Work', 'Outcome_After'],
} as const;

export const METADATA_VALIDATION = {
  geo_coords_pattern:
    '^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?),\\s*[-+]?(180(\\.0+)?|((1[0-7]\\d)|(\\d{1,2}))(\\.\\d+)?)$',
  ndvi_delta_min: -1,
  ndvi_delta_max: 1,
  iqa_min: 0,
  iqa_max: 1,
  obj_count_min: 0,
  impact_summary_max: 1000,
  base_asset_id_max: 255,
} as const;
