import { describe, expect, it } from 'vitest';
import { buildFieldRules, buildPlan, summarizePlan } from './setup-metadata.js';
import { applyPlan, createAdminClient, type AdminClient } from './admin-client.js';

const noExisting = { existingFields: [], existingDatasources: [] };

function fieldIds(plan: ReturnType<typeof buildPlan>): string[] {
  return plan.filter((a) => a.kind === 'field').map((a) => a.external_id);
}

describe('build plan', () => {
  it('creates the three lists and the ten fields', () => {
    const plan = buildPlan(noExisting);
    expect(plan.filter((a) => a.kind === 'datasource')).toHaveLength(3);
    expect(plan.filter((a) => a.kind === 'field')).toHaveLength(10);
  });

  it('creates the lists before the fields', () => {
    const plan = buildPlan(noExisting);
    const lastList = plan.findLastIndex((a) => a.kind === 'datasource');
    const firstField = plan.findIndex((a) => a.kind === 'field');
    expect(lastList).toBeLessThan(firstField);
  });

  it('names every field we promised', () => {
    expect(fieldIds(buildPlan(noExisting)).sort()).toEqual(
      [
        'base_asset_id',
        'c2pa_valid',
        'geo_coords',
        'impact_summary',
        'iqa_score',
        'ndvi_delta',
        'obj_count',
        'proj_id',
        'tempo_phase',
        'veri_status',
      ].sort(),
    );
  });

  it('leaves existing fields alone', () => {
    const plan = buildPlan({
      existingFields: [{ external_id: 'proj_id' }],
      existingDatasources: [{ external_id: 'proj_list' }],
    });
    const skips = plan.filter((a) => a.kind === 'skip').map((a) => a.external_id);
    expect(skips).toContain('proj_id');
    expect(skips).toContain('proj_list');
  });

  it('is safe to run twice', () => {
    const created = buildPlan(noExisting)
      .filter((a) => a.kind !== 'skip')
      .map((a) => a.external_id);
    const second = buildPlan({
      existingFields: created.map((external_id) => ({ external_id })),
      existingDatasources: created.map((external_id) => ({ external_id })),
    });
    expect(second.every((a) => a.kind === 'skip')).toBe(true);
  });

  it('still creates what is missing on a second run', () => {
    const plan = buildPlan({
      existingFields: [{ external_id: 'proj_id' }],
      existingDatasources: [],
    });
    expect(fieldIds(plan)).not.toContain('proj_id');
    expect(fieldIds(plan)).toContain('iqa_score');
  });
});

describe('field rules', () => {
  it('pins the coordinates to a map pattern', () => {
    const rules = buildFieldRules('geo_coords', 'string');
    expect(String((rules.restrictions as { regex: string }).regex)).toContain('180');
  });

  it('keeps plant change between minus one and one', () => {
    const rules = buildFieldRules('ndvi_delta', 'number');
    const numeric = (rules.restrictions as { numeric: { greater_than: number; less_than: number } })
      .numeric;
    expect(numeric.greater_than).toBe(-1);
    expect(numeric.less_than).toBe(1);
  });

  it('keeps clarity between zero and one', () => {
    const rules = buildFieldRules('iqa_score', 'number');
    const numeric = (rules.restrictions as { numeric: { greater_than: number; less_than: number } })
      .numeric;
    expect(numeric.greater_than).toBe(0);
    expect(numeric.less_than).toBe(1);
  });

  it('stops a negative count', () => {
    const rules = buildFieldRules('obj_count', 'number');
    expect((rules.restrictions as { numeric: { greater_than: number } }).numeric.greater_than).toBe(
      0,
    );
  });

  it('caps the summary length', () => {
    const rules = buildFieldRules('impact_summary', 'string');

    function recordingClient(overrides: Partial<AdminClient> = {}) {
      const datasources: string[] = [];
      const fields: Record<string, unknown>[] = [];
      const client: AdminClient = {
        async listFields() {
          return fields.map((f) => ({ external_id: String(f.external_id) }));
        },
        async listDatasources() {
          return datasources.map((external_id) => ({ external_id }));
        },
        async createDatasource(externalId) {
          datasources.push(externalId);
        },
        async createField(body) {
          fields.push(body);
        },
        ...overrides,
      };
      return { client, datasources, fields };
    }

    describe('apply plan', () => {
      it('creates everything in a fresh account', async () => {
        const { client, datasources, fields } = recordingClient();
        const result = await applyPlan(buildPlan(noExisting), client);
        expect(result.created).toBe(13);
        expect(datasources).toHaveLength(3);
        expect(fields).toHaveLength(10);
      });

      it('sends the label and the rules with each field', async () => {
        const { client, fields } = recordingClient();
        await applyPlan(buildPlan(noExisting), client);
        const iqa = fields.find((f) => f.external_id === 'iqa_score');
        expect(iqa?.label).toBe('Image Quality Score');
        expect(iqa?.restrictions).toBeDefined();
      });

      it('is safe to run twice on the same account', async () => {
        const { client } = recordingClient();
        await applyPlan(buildPlan(noExisting), client);
        const fields = await client.listFields();
        const lists = await client.listDatasources();
        const second = await applyPlan(
          buildPlan({ existingFields: fields, existingDatasources: lists }),
          client,
        );
        expect(second.created).toBe(0);
        expect(second.skipped).toBe(13);
      });

      it('stops and says so when cloudinary refuses', async () => {
        const { client } = recordingClient({
          async createDatasource() {
            throw new Error('cloudinary admin answered 401 for /metadata_datasources');
          },
        });
        await expect(applyPlan(buildPlan(noExisting), client)).rejects.toThrow('answered 401');
      });
    });
    expect((rules.restrictions as { strlen: number }).strlen).toBe(1000);
  });

  it('leaves a plain field with no rules', () => {
    expect(buildFieldRules('c2pa_valid', 'boolean')).toEqual({ type: 'boolean' });
  });
});

describe('plan summary', () => {
  it('counts what will be made and what will be kept', () => {
    const summary = summarizePlan(buildPlan(noExisting));
    expect(summary.create).toBe(13);
    expect(summary.skip).toBe(0);
    expect(summary.lines).toHaveLength(13);
  });
});

function recordingClient(overrides: Partial<AdminClient> = {}) {
  const datasources: string[] = [];
  const fields: Record<string, unknown>[] = [];
  const client: AdminClient = {
    async listFields() {
      return fields.map((f) => ({ external_id: String(f.external_id) }));
    },
    async listDatasources() {
      return datasources.map((external_id) => ({ external_id }));
    },
    async createDatasource(externalId) {
      datasources.push(externalId);
    },
    async createField(body) {
      fields.push(body);
    },
    ...overrides,
  };
  return { client, datasources, fields };
}

describe('apply plan', () => {
  it('creates everything in a fresh account', async () => {
    const { client, datasources, fields } = recordingClient();
    const result = await applyPlan(buildPlan(noExisting), client);
    expect(result.created).toBe(13);
    expect(datasources).toHaveLength(3);
    expect(fields).toHaveLength(10);
  });

  it('sends the label and the rules with each field', async () => {
    const { client, fields } = recordingClient();
    await applyPlan(buildPlan(noExisting), client);
    const iqa = fields.find((f) => f.external_id === 'iqa_score');
    expect(iqa?.label).toBe('Image Quality Score');
    expect(iqa?.restrictions).toBeDefined();
  });

  it('is safe to run twice on the same account', async () => {
    const { client } = recordingClient();
    await applyPlan(buildPlan(noExisting), client);
    const fields = await client.listFields();
    const lists = await client.listDatasources();
    const second = await applyPlan(
      buildPlan({ existingFields: fields, existingDatasources: lists }),
      client,
    );
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(13);
  });

  it('stops and says so when cloudinary refuses', async () => {
    const { client } = recordingClient({
      async createDatasource() {
        throw new Error('cloudinary admin answered 401 for /metadata_datasources');
      },
    });
    await expect(applyPlan(buildPlan(noExisting), client)).rejects.toThrow('answered 401');
  });
});

describe('admin client', () => {
  const env = { cloudName: 'impact-cloud', apiKey: 'k', apiSecret: 's' };

  it('reads the current fields', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: string) => {
      calls.push(input);
      return {
        ok: true,
        status: 200,
        json: async () => ({ metadata_fields: [{ external_id: 'proj_id' }] }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const client = createAdminClient(env, fetchImpl);
    expect(await client.listFields()).toHaveLength(1);
    expect(calls[0]).toContain('impact-cloud/metadata_fields');
  });

  it('reads the current lists', async () => {
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ metadata_datasources: [{ external_id: 'proj_list' }] }),
    })) as unknown as typeof fetch;
    const client = createAdminClient(env, fetchImpl);
    expect(await client.listDatasources()).toHaveLength(1);
  });

  it('copes with an account that has nothing yet', async () => {
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const client = createAdminClient(env, fetchImpl);
    expect(await client.listFields()).toEqual([]);
    expect(await client.listDatasources()).toEqual([]);
  });

  it('sends the list values as a real array', async () => {
    let sent: unknown = null;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;
    const client = createAdminClient(env, fetchImpl);
    await client.createDatasource('proj_list', ['WATER-01']);
    expect(sent).toEqual({ external_id: 'proj_list', values: ['WATER-01'] });
  });

  it('turns a refusal into a clear message', async () => {
    const fetchImpl = (async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const client = createAdminClient(env, fetchImpl);
    await expect(client.listFields()).rejects.toThrow('answered 401');
  });
});
