import { createHash } from 'node:crypto';
export function profileImage(
  value: unknown,
): { bytes: Buffer; name: string } | null {
  if (typeof value !== 'string' || value.length > 7_000_000) return null;
  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 5 * 1024 * 1024 || bytes.length < 12) return null;
  const mime = match[1];
  if (
    mime === 'png' &&
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return null;
  if (
    mime === 'jpeg' &&
    (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)
  )
    return null;
  if (
    mime === 'webp' &&
    (bytes.toString('ascii', 0, 4) !== 'RIFF' ||
      bytes.toString('ascii', 8, 12) !== 'WEBP')
  )
    return null;
  return {
    bytes,
    name: `portrait-${createHash('sha256').update(bytes).digest('hex').slice(0, 24)}.${mime === 'jpeg' ? 'jpg' : mime}`,
  };
}
