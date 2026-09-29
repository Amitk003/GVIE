import type { SectorName } from '@gvie/schemas';

/**
 * Read a sector name from text. Anything we do not have a schema for is refused,
 * because an unknown sector means an unknown set of rules.
 */
export function parseSector(value: string): SectorName | null {
  const key = value.trim().toLowerCase();
  if (key === 'water' || key === 'forest' || key === 'solar') return key;
  return null;
}

export const SECTOR_NAMES: SectorName[] = ['water', 'forest', 'solar'];
