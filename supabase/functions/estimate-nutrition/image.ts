// Structural headers/dimensions, not a full image decoder or malware scanner.
// Provider decoding can still reject a corrupt image; no estimate is fabricated.
export function validImageHeader(bytes: Uint8Array, type: string): boolean {
  const b = (i: number) => bytes[i];
  const ascii = (i: number, n: number) =>
    String.fromCharCode(...bytes.slice(i, i + n));
  const be16 = (i: number) => b(i) * 256 + b(i + 1);
  const be32 = (i: number) =>
    b(i) * 16777216 + b(i + 1) * 65536 + b(i + 2) * 256 + b(i + 3);
  const le24 = (i: number) => b(i) + b(i + 1) * 256 + b(i + 2) * 65536;
  const le32 = (i: number) => le24(i) + b(i + 3) * 16777216;
  const sane = (w: number, h: number) =>
    Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 &&
    w <= 12000 && h <= 12000 && w * h <= 40_000_000;
  if (type === "jpeg") {
    if (
      bytes.length < 20 || b(0) !== 255 || b(1) !== 216 ||
      b(bytes.length - 2) !== 255 || b(bytes.length - 1) !== 217
    ) return false;
    let pos = 2;
    let dimensions = false;
    while (pos + 4 <= bytes.length) {
      if (b(pos++) !== 255) return false;
      while (b(pos) === 255) pos++;
      const marker = b(pos++);
      const length = be16(pos);
      if (length < 2 || pos + length > bytes.length) return false;
      if (
        [
          0xc0,
          0xc1,
          0xc2,
          0xc3,
          0xc5,
          0xc6,
          0xc7,
          0xc9,
          0xca,
          0xcb,
          0xcd,
          0xce,
          0xcf,
        ].includes(marker)
      ) {
        if (length < 8 || !sane(be16(pos + 5), be16(pos + 3))) return false;
        dimensions = true;
      }
      if (marker === 0xda) return dimensions; // entropy data is left to the decoder
      pos += length;
    }
  }
  if (type === "png") {
    if (
      ascii(0, 8) !== "\x89PNG\r\n\x1a\n" || be32(8) !== 13 ||
      ascii(12, 4) !== "IHDR" || !sane(be32(16), be32(20))
    ) return false;
    let pos = 8;
    let data = false;
    while (pos + 12 <= bytes.length) {
      const length = be32(pos);
      const kind = ascii(pos + 4, 4);
      if (pos + 12 + length > bytes.length) return false;
      if (kind === "IHDR" && pos !== 8) return false;
      if (kind === "acTL") return false; // animation is unnecessary for meal estimates
      if (kind === "IDAT") data = true;
      if (kind === "IEND") {
        return data && length === 0 && pos + 12 === bytes.length;
      }
      pos += 12 + length;
    }
  }
  if (type === "webp") {
    if (
      bytes.length < 30 || ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WEBP" ||
      le32(4) + 8 !== bytes.length
    ) return false;
    let pos = 12;
    let image = false;
    while (pos + 8 <= bytes.length) {
      const kind = ascii(pos, 4);
      const length = le32(pos + 4);
      const start = pos + 8;
      if (start + length > bytes.length) return false;
      if (kind === "ANIM" || kind === "ANMF") return false;
      if (
        kind === "VP8X" &&
        (length !== 10 || (b(start) & 2) ||
          !sane(le24(start + 4) + 1, le24(start + 7) + 1))
      ) return false;
      if (kind === "VP8L") {
        if (
          length < 5 || b(start) !== 0x2f ||
          !sane(
            1 + (b(start + 1) | ((b(start + 2) & 63) << 8)),
            1 +
              ((b(start + 2) >> 6) | (b(start + 3) << 2) |
                ((b(start + 4) & 15) << 10)),
          )
        ) return false;
        image = true;
      }
      if (kind === "VP8 ") {
        if (
          length < 10 || (b(start) & 1) ||
          ascii(start + 3, 3) !== "\x9d\x01\x2a" ||
          !sane(
            (b(start + 6) | b(start + 7) << 8) & 0x3fff,
            (b(start + 8) | b(start + 9) << 8) & 0x3fff,
          )
        ) return false;
        image = true;
      }
      pos = start + length + (length % 2);
    }
    return image && pos === bytes.length;
  }
  return false;
}
