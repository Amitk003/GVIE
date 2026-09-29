/**
 * The calls that talk to the Cloudinary Admin API.
 *
 * Everything here is injectable so the tests never touch the real account.
 */

import type { CloudinaryAdminEnv, ExistingDatasource, ExistingField, PlanAction } from './setup-metadata.js';

export type AdminClient = {
  listFields(): Promise<ExistingField[]>;
  listDatasources(): Promise<ExistingDatasource[]>;
  createDatasource(externalId: string, values: readonly string[]): Promise<void>;
  createField(body: Record<string, unknown>): Promise<void>;
};

function authHeader(env: CloudinaryAdminEnv): string {
  return `Basic ${Buffer.from(`${env.apiKey}:${env.apiSecret}`).toString('base64')}`;
}

export function createAdminClient(
  env: CloudinaryAdminEnv,
  fetchImpl: typeof fetch = fetch,
): AdminClient {
  const base = `https://api.cloudinary.com/v1_1/${env.cloudName}`;

  async function get<T>(path: string): Promise<T> {
    const response = await fetchImpl(`${base}${path}`, {
      headers: { authorization: authHeader(env) },
    });
    if (!response.ok) {
      throw new Error(`cloudinary admin answered ${response.status} for ${path}`);
    }
    return (await response.json()) as T;
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetchImpl(`${base}${path}`, {
      method: 'POST',
      headers: {
        authorization: authHeader(env),
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`cloudinary admin answered ${response.status} for ${path}`);
    }
    return (await response.json()) as T;
  }

  return {
    async listFields() {
      const data = await get<{ metadata_fields?: ExistingField[] }>('/metadata_fields');
      return data.metadata_fields ?? [];
    },
    async listDatasources() {
      const data = await get<{ metadata_datasources?: ExistingDatasource[] }>(
        '/metadata_datasources',
      );
      return data.metadata_datasources ?? [];
    },
    async createDatasource(externalId, values) {
      await post('/metadata_datasources', { external_id: externalId, values: [...values] });
    },
    async createField(body) {
      await post('/metadata_fields', body);
    },
  };
}

export type RunResult = {
  created: number;
  skipped: number;
  lines: string[];
};

export async function applyPlan(
  plan: PlanAction[],
  client: AdminClient,
  onLine: (line: string) => void = () => undefined,
): Promise<RunResult> {
  let created = 0;
  let skipped = 0;

  for (const action of plan) {
    if (action.kind === 'datasource') {
      await client.createDatasource(action.external_id, action.values);
      created += 1;
      onLine(`created list  ${action.external_id}`);
      continue;
    }
    if (action.kind === 'field') {
      await client.createField({
        external_id: action.external_id,
        label: action.label,
        ...action.extra,
      });
      created += 1;
      onLine(`created field  ${action.external_id}`);
      continue;
    }
    skipped += 1;
    onLine(`kept         ${action.external_id} (${action.why})`);
  }

  return { created, skipped, lines: plan.length };
}
