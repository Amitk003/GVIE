/**
 * Where the web app talks to the API.
 *
 * The browser never sees Cloudinary keys. It asks our API, and the API signs
 * what it hands back.
 */

import { z } from 'zod';

export const apiBaseSchema = z
  .string()
  .url()
  .default('http://localhost:4000')
  .refine((value) => value.startsWith('https://') || value.includes('localhost'), {
    message: 'the api address must use https unless it is localhost',
  });

export type ApiBase = z.infer<typeof apiBaseSchema>;

export function readApiBase(input: string | undefined = process.env.NEXT_PUBLIC_API_BASE) {
  const parsed = apiBaseSchema.safeParse(input ?? undefined);
  return parsed.success ? parsed.data : 'http://localhost:4000';
}

export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function buildUrl(base: ApiBase, path: string, query?: Record<string, string | number>): string {
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: string; details?: string[] };
    return new ApiError(
      response.status,
      body.error ?? 'the api did not give a reason',
      Array.isArray(body.details) ? body.details : [],
    );
  } catch {
    return new ApiError(response.status, `the api answered ${response.status}`);
  }
}

/**
 * Field phones lose signal in the field. A dead network must read as a clear
 * message, not as a stack trace the worker has to decode.
 */
async function callApi(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'no connection';
    throw new ApiError(0, `could not reach the api: ${reason}`);
  }
  if (!response.ok) throw await readError(response);
  try {
    return await response.json();
  } catch {
    throw new ApiError(response.status, 'the api sent something we could not read');
  }
}

export type SignedUpload = {
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  folder: string;
  params: Record<string, string>;
};

export async function requestUploadSignature(
  base: ApiBase,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<SignedUpload> {
  const data = await callApi(
    buildUrl(base, '/v1/uploads/sign'),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    fetchImpl,
  );
  return data as SignedUpload;
}

export type AssetSummary = {
  publicId: string;
  thumbUrl: string;
  compareUrl: string | null;
  veriStatus: string | null;
  objCount: number | null;
  ndviDelta: number | null;
  sha256: string | null;
};

export async function searchAssets(
  base: ApiBase,
  query: { projId?: string; veriStatus?: string; max?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<AssetSummary[]> {
  const data = await callApi(
    buildUrl(base, '/v1/assets', {
      ...(query.projId ? { proj_id: query.projId } : {}),
      ...(query.veriStatus ? { veri_status: query.veriStatus } : {}),
      ...(query.max ? { max: query.max } : {}),
    }),
    { method: 'GET' },
    fetchImpl,
  );
  const body = (data ?? {}) as { results?: unknown[] };
  return (body.results ?? []).map(toAssetSummary);
}

/**
 * Cloudinary search results come back with a mix of shapes depending on what was
 * asked for. We pull out only the fields the screens need, and we never trust
 * anything without checking it first.
 */
export function toAssetSummary(raw: unknown): AssetSummary {
  const record = (raw ?? {}) as Record<string, unknown>;
  const metadata = (record.metadata ?? {}) as Record<string, unknown>;
  const publicId = String(record.public_id ?? record.publicId ?? '');

  return {
    publicId,
    thumbUrl:
      typeof record.thumbUrl === 'string' && record.thumbUrl !== ''
        ? record.thumbUrl
        : `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUD_NAME ?? 'demo'}/image/upload/c_fill,w_400,q_auto,f_auto/${publicId}`,
    compareUrl: typeof record.compareUrl === 'string' ? record.compareUrl : null,
    veriStatus: textOrNull(metadata.veri_status ?? record.veri_status),
    objCount: numberOrNull(metadata.obj_count ?? record.obj_count),
    ndviDelta: numberOrNull(metadata.ndvi_delta ?? record.ndvi_delta),
    sha256: textOrNull(record.sha256),
  };
}

function textOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
