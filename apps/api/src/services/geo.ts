/**
 * Distance helpers.
 *
 * Field staff stand a few metres apart between the before shot and the after
 * shot. If that gap is more than the limit we do not trust the pin, we flag it.
 */

const EARTH_RADIUS_M = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(
  a: { lat: number; long: number },
  b: { lat: number; long: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLong = toRadians(b.long - a.long);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLong / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type GeoPoint = { lat: number; long: number };

export function parseGeoCoordsText(text: string | null): GeoPoint | null {
  if (!text) return null;
  const parts = text.split(',');
  if (parts.length !== 2) return null;
  const lat = Number.parseFloat(parts[0].trim());
  const long = Number.parseFloat(parts[1].trim());
  if (!Number.isFinite(lat) || !Number.isFinite(long)) return null;
  if (lat < -90 || lat > 90 || long < -180 || long > 180) return null;
  return { lat, long };
}
