import type { CloudinaryEnv } from '@gvie/cloudinary';

export type CloudinarySearch = {
  search(expression: string, maxResults: number): Promise<unknown[]>;
};

export function createCloudinarySearch(
  cloud: CloudinaryEnv,
  fetchImpl: typeof fetch = fetch,
): CloudinarySearch {
  return {
    async search(expression: string, maxResults: number): Promise<unknown[]> {
      const credentials = Buffer.from(`${cloud.apiKey}:${cloud.apiSecret}`).toString('base64');
      const response = await fetchImpl(
        `https://api.cloudinary.com/v1_1/${cloud.cloudName}/resources/search`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Basic ${credentials}`,
          },
          body: JSON.stringify({ expression, max_results: maxResults }),
        },
      );
      if (!response.ok) {
        throw new Error(`cloudinary search failed with ${response.status}`);
      }
      const data = (await response.json()) as { resources?: unknown[] };
      return data.resources ?? [];
    },
  };
}

export type AnalyzeRunnerInput = { publicId: string; sector: string; imageUrl: string };

export function createCloudinaryAnalyzeRunner(
  cloud: CloudinaryEnv,
  fetchImpl: typeof fetch = fetch,
  endpoint = 'https://api.cloudinary.com/v2/analysis',
): (input: AnalyzeRunnerInput) => Promise<{ ok: boolean; reason?: string }> {
  return async (input) => {
    const credentials = Buffer.from(`${cloud.apiKey}:${cloud.apiSecret}`).toString('base64');
    const response = await fetchImpl(
      `${endpoint}/${cloud.cloudName}/analyze/ai_vision_tagging`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({
          source: { uri: input.imageUrl },
          prompts: [`Analyze this ${input.sector} site and follow the schema.`],
        }),
      },
    );
    if (!response.ok) {
      return { ok: false, reason: `analyze failed with ${response.status}` };
    }
    return { ok: true };
  };
}
