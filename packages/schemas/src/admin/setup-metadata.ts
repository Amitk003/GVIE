/**
 * Create the ten metadata fields in a Cloudinary account.
 *
 * Without this the whole system has nowhere to put its numbers, so this runs
 * first when someone sets up a new account. It is safe to run again: anything
 * already there is left alone, and the script says what it would do before it
 * touches anything.
 */

import {
  METADATA_DATASOURCES,
  METADATA_FIELDS,
  METADATA_VALIDATION,
} from '../cloudinary-fields.js';

export type CloudinaryAdminEnv = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export type PlanAction =
  | { kind: 'datasource'; external_id: string; values: readonly string[] }
  | { kind: 'field'; external_id: string; type: string; label: string; extra: Record<string, unknown> }
  | { kind: 'skip'; external_id: string; why: string };

export type ExistingField = { external_id: string; type?: string };
export type ExistingDatasource = { external_id: string };

export function buildPlan(input: {
  existingFields: ExistingField[];
  existingDatasources: ExistingDatasource[];
}): PlanAction[] {
  const haveFields = new Set(input.existingFields.map((field) => field.external_id));
  const haveSources = new Set(input.existingDatasources.map((source) => source.external_id));
  const plan: PlanAction[] = [];

  for (const [externalId, values] of Object.entries(METADATA_DATASOURCES)) {
    if (haveSources.has(externalId)) {
      plan.push({ kind: 'skip', external_id: externalId, why: 'list already exists' });
      continue;
    }
    plan.push({ kind: 'datasource', external_id: externalId, values });
  }

  for (const field of METADATA_FIELDS) {
    if (haveFields.has(field.external_id)) {
      plan.push({ kind: 'skip', external_id: field.external_id, why: 'field already exists' });
      continue;
    }
    plan.push({
      kind: 'field',
      external_id: field.external_id,
      type: field.type,
      label: field.label,
      extra: buildFieldRules(field.external_id, field.type),
    });
  }

  return plan;
}

/**
 * Turn our field name into the rules Cloudinary expects. The rules are the whole
 * point: a bad pin or a plant change of 5 must be refused at the door.
 */
export function buildFieldRules(
  externalId: string,
  type: string,
): Record<string, unknown> {
  switch (externalId) {
    case 'geo_coords':
      return { type, restrictions: { regex: METADATA_VALIDATION.geo_coords_pattern } };
    case 'ndvi_delta':
      return {
        type,
        restrictions: {
          numeric: {
            greater_than: METADATA_VALIDATION.ndvi_delta_min,
            less_than: METADATA_VALIDATION.ndvi_delta_max,
          },
        },
      };
    case 'iqa_score':
      return {
        type,
        restrictions: {
          numeric: { greater_than: METADATA_VALIDATION.iqa_min, less_than: METADATA_VALIDATION.iqa_max },
        },
      };
    case 'obj_count':
      return {
        type,
        restrictions: { numeric: { greater_than: METADATA_VALIDATION.obj_count_min } },
      };
    case 'impact_summary':
      return { type, restrictions: { strlen: METADATA_VALIDATION.impact_summary_max } };
    case 'base_asset_id':
      return { type, restrictions: { strlen: METADATA_VALIDATION.base_asset_id_max } };
    default:
      return { type };
  }
}

export function summarizePlan(plan: PlanAction[]): {
  create: number;
  skip: number;
  lines: string[];
} {
  const lines = plan.map((action) => {
    if (action.kind === 'datasource') {
      return `create list  ${action.external_id} (${action.values.length} values)`;
    }
    if (action.kind === 'field') {
      return `create field  ${action.external_id} (${action.type})`;
    }
    return `keep         ${action.external_id} (${action.why})`;
  });
  return {
    create: plan.filter((action) => action.kind !== 'skip').length,
    skip: plan.filter((action) => action.kind === 'skip').length,
    lines,
  };
}
