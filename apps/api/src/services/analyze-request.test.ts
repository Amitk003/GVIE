import { describe, expect, it } from 'vitest';
import { analyzeEndpointUrl, buildAnalyzeRequest, parseSector } from './analyze-request.js';

describe('analyze request', () => {
  it('builds the v2 tagging url', () => {
    expect(analyzeEndpointUrl('impact-cloud')).toBe(
      'https://api.cloudinary.com/v2/analysis/impact-cloud/analyze/ai_vision_tagging',
    );
  });

  it('uses the sector schema and prompt', () => {
    const request = buildAnalyzeRequest({
      cloudName: 'impact-cloud',
      sector: 'water',
      imageUrl: 'https://res.cloudinary.com/impact-cloud/image/upload/v1/borehole.jpg',
    });
    expect(request.body.source.uri).toContain('borehole.jpg');
    expect(request.body.prompts).toHaveLength(1);
    expect(request.body.json_schema.required).toContain('operational_status');
    expect(request.body.json_schema.additionalProperties).toBe(false);
  });

  it('adds an extra instruction when asked', () => {
    const request = buildAnalyzeRequest({
      cloudName: 'c',
      sector: 'forest',
      imageUrl: 'u',
      extraInstruction: 'Focus on the left side.',
    });
    expect(request.body.prompts).toHaveLength(2);
    expect(request.body.json_schema.required).toContain('canopy_cover_pct');
  });

  it('never allows extra fields in the schema', () => {
    for (const sector of ['water', 'forest', 'solar'] as const) {
      const request = buildAnalyzeRequest({ cloudName: 'c', sector, imageUrl: 'u' });
      expect(request.body.json_schema.additionalProperties).toBe(false);
      expect(request.body.json_schema.required.length).toBeGreaterThan(0);
    }
  });

  it('reads sector names in any case', () => {
    expect(parseSector(' WATER ')).toBe('water');
    expect(parseSector('Solar')).toBe('solar');
    expect(parseSector('unknown')).toBeNull();
  });
});
