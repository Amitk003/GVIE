import { jsonSchemaBySector, sectorPromptBySector, type SectorName } from '@gvie/schemas';
import type { JSONSchema7 } from '@gvie/schemas';

export type AnalyzeRequest = {
  url: string;
  body: {
    source: { uri: string };
    prompts: string[];
    json_schema: JSONSchema7;
  };
};

export function analyzeEndpointUrl(cloudName: string): string {
  return `https://api.cloudinary.com/v2/analysis/${cloudName}/analyze/ai_vision_tagging`;
}

export function buildAnalyzeRequest(input: {
  cloudName: string;
  sector: SectorName;
  imageUrl: string;
  extraInstruction?: string;
}): AnalyzeRequest {
  const prompt = sectorPromptBySector[input.sector];
  const prompts = input.extraInstruction ? [prompt, input.extraInstruction] : [prompt];
  return {
    url: analyzeEndpointUrl(input.cloudName),
    body: {
      source: { uri: input.imageUrl },
      prompts,
      json_schema: jsonSchemaBySector[input.sector],
    },
  };
}

export function parseSector(value: string): SectorName | null {
  const key = value.trim().toLowerCase();
  if (key === 'water' || key === 'forest' || key === 'solar') return key;
  return null;
}

export function isKnownTaggingEndpoint(value: string): boolean {
  return /\/analyze\/ai_vision_tagging$/.test(value);
}
