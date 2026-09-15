// One-off PWA icon generator -- no image-processing tool (ImageMagick/sharp) is available in
// this environment, so this writes raw PNG bytes directly via zlib. Draws a simple forest-green
// square with a lighter circular badge, matching the brand palette (#1B4332 / #F0FDF4) closely
// enough for a placeholder maskable icon. Run once: `node scripts/generate-icons.cjs`.
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = []
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function makePng(size) {
  const primary900 = [0x0d, 0x28, 0x18]
  const primary800 = [0x1b, 0x43, 0x32]
  const gold400 = [0xe9, 0xb9, 0x49]

  const raw = Buffer.alloc(size * (1 + size * 4))
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.32

  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4)
    raw[rowStart] = 0 // filter type: none
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      let color
      if (dist < r) color = gold400
      else if (dist < r * 1.08) color = primary900
      else color = primary800
      const px = rowStart + 1 + x * 4
      raw[px] = color[0]
      raw[px + 1] = color[1]
      raw[px + 2] = color[2]
      raw[px + 3] = 255
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = zlib.deflateSync(raw)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })
for (const size of [192, 512]) {
  const buf = makePng(size)
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), buf)
  console.log(`Wrote icon-${size}.png (${buf.length} bytes)`)
}
