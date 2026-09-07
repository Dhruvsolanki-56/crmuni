const signatures: Record<string, (bytes: Uint8Array) => boolean> = {
  'application/pdf': (b) => text(b, 5) === '%PDF-',
  'image/png': (b) => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': (b) => starts(b, [0xff, 0xd8, 0xff]),
  'image/webp': (b) => text(b, 4) === 'RIFF' && text(b.slice(8), 4) === 'WEBP',
  'audio/wav': (b) => text(b, 4) === 'RIFF' && text(b.slice(8), 4) === 'WAVE',
  'audio/ogg': (b) => text(b, 4) === 'OggS',
  'audio/webm': (b) => starts(b, [0x1a, 0x45, 0xdf, 0xa3]),
  'audio/mp4': (b) => text(b.slice(4), 4) === 'ftyp',
  'audio/mpeg': (b) => text(b, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (b) => starts(b, [0x50, 0x4b, 0x03, 0x04]) && containsAscii(b, '[Content_Types].xml') && containsAscii(b, 'word/'),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (b) => starts(b, [0x50, 0x4b, 0x03, 0x04]) && containsAscii(b, '[Content_Types].xml') && containsAscii(b, 'xl/'),
};

function starts(bytes: Uint8Array, expected: number[]) { return expected.every((value, index) => bytes[index] === value); }
function text(bytes: Uint8Array, length: number) { return new TextDecoder('latin1').decode(bytes.slice(0, length)); }
function containsAscii(bytes: Uint8Array, value: string) {
  const expected = new TextEncoder().encode(value);
  outer: for (let index = 0; index <= bytes.length - expected.length; index += 1) {
    for (let offset = 0; offset < expected.length; offset += 1) if (bytes[index + offset] !== expected[offset]) continue outer;
    return true;
  }
  return false;
}

export async function validateUpload(file: File, allowed: Set<string>, maxBytes: number) {
  if (!allowed.has(file.type)) return 'unsupported_type';
  if (!file.size || file.size > maxBytes) return 'invalid_size';
  const isOfficeFile = file.type.includes('openxmlformats-officedocument');
  const bytes = new Uint8Array(await (isOfficeFile ? file : file.slice(0, 512)).arrayBuffer());
  const signature = signatures[file.type];
  if (signature && !signature(bytes)) return 'content_type_mismatch';
  if (file.type === 'text/plain' || file.type === 'text/csv') {
    if (bytes.includes(0)) return 'content_type_mismatch';
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return 'content_type_mismatch'; }
  }
  return null;
}
