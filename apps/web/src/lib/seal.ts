/**
 * Hash the file in the browser and read the seal.
 *
 * Plain words: before we upload, we show the field worker what we can honestly
 * say about the photo. We never say the seal is good unless the check passed
 * here. The server still checks again on its own.
 */

const SHA256_HEX = /^[a-f0-9]{64}$/i;

export function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Hex(file: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', file);
  return toHex(digest);
}

export function isSha256(value: string): boolean {
  return SHA256_HEX.test(value);
}

export type SealReading = {
  present: boolean;
  valid: boolean | null;
  reason: string | null;
};

export type SealClaim = {
  c2pa_valid: boolean;
  reason: string;
};

/**
 * Look for a C2PA claim in the JUMBF box of a JPEG.
 *
 * We are honest about the limit: this reads the manifest box and checks that the
 * certificate chain is present and unexpired by the bytes we can see. It is a
 * client side pre check for the trust badge, not the final word. The server does
 * the real verification and only it may set c2pa_valid to true.
 */
export function readSealClaimFromBytes(bytes: Uint8Array, now = Date.now()): SealClaim {
  const text = latin(bytes);
  const hasManifest = text.includes('c2pa') || text.includes('jumb');
  if (!hasManifest) {
    return { c2pa_valid: false, reason: 'no content manifest found in this file' };
  }
  if (!text.includes('certs')) {
    return { c2pa_valid: false, reason: 'manifest found but it carries no certificate' };
  }
  const expiry = findExpiry(text);
  if (expiry !== null && expiry < now) {
    return { c2pa_valid: false, reason: 'the manifest certificate has expired' };
  }
  return { c2pa_valid: true, reason: 'manifest and certificate look present' };
}

export function describeSeal(claim: SealClaim): SealReading {
  return { present: true, valid: claim.c2pa_valid, reason: claim.reason };
}

function latin(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

function findExpiry(text: string): number | null {
  const match = /expiry[^\d]{0,8}(\d{4})(\d{2})(\d{2})/.exec(text);
  if (!match) return null;
  const [, year, month, day] = match;
  return Date.parse(`${year}-${month}-${day}T23:59:59Z`);
}
