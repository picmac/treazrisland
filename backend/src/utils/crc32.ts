const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      if ((crc & 1) !== 0) {
        crc = 0xedb88320 ^ (crc >>> 1);
      } else {
        crc >>>= 1;
      }
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

export class Crc32 {
  private crc = 0xffffffff;

  update(buffer: Buffer): void {
    let crc = this.crc;
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    this.crc = crc >>> 0;
  }

  digest(): number {
    return (this.crc ^ 0xffffffff) >>> 0;
  }
}
