export function searchByTextAndMeta(input: {
  text?: string;
  projId?: string;
  veriStatus?: string;
  tempoPhase?: string;
  maxResults?: number;
}): string {
  const parts: string[] = ['resource_type:image'];
  if (input.text) parts.push(`"${input.text.replaceAll('"', '')}"`);
  if (input.projId) parts.push(`metadata.proj_id="${input.projId}"`);
  if (input.veriStatus) parts.push(`metadata.veri_status="${input.veriStatus}"`);
  if (input.tempoPhase) parts.push(`metadata.tempo_phase="${input.tempoPhase}"`);
  const max = input.maxResults ?? 50;
  return `${parts.join(' AND ')}||sort_by=created_at:desc||max=${max}`;
}

export function baselineSearchFor(input: {
  projId: string;
  lat: number;
  long: number;
  radiusKm?: number;
}): Record<string, unknown> {
  const radius = input.radiusKm ?? 2;
  return {
    expression: `resource_type:image AND metadata.proj_id="${input.projId}" AND metadata.tempo_phase="Baseline_Before"`,
    sort_by: [{ created_at: 'desc' }],
    max_results: 10,
    geo: { lat: input.lat, long: input.long, radius_km: radius },
  };
}
