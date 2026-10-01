import { createHash } from 'node:crypto';

export function resumeDocument(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length > 7_000_000 ||
    !/^data:application\/pdf;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    return null;
  const bytes = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
  if (
    bytes.length > 5 * 1024 * 1024 ||
    !bytes
      .subarray(0, 8)
      .toString('ascii')
      .match(/^%PDF-1\.[0-7]|^%PDF-2\.0/) ||
    !bytes.subarray(-1024).includes(Buffer.from('%%EOF'))
  )
    return null;
  return {
    bytes,
    name: `resume-${createHash('sha256').update(bytes).digest('hex').slice(0, 24)}.pdf`,
  };
}
