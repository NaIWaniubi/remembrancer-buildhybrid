// Generates Remembrancer toolbar icons (16/48/128 px PNG) with zero dependencies:
// raw raster rendering + Node zlib.deflateSync for the IDAT stream + hand-rolled CRC32.
// Usage: node tools/make-icons.mjs   (writes icons/icon16.png icon48.png icon128.png)
// This keeps every shipped asset local — no external resource links anywhere.

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'icons')

// ---- PNG encoder -----------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  // scanlines with filter byte 0 prefix
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const idat = deflateSync(raw, { level: 9 })

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---- painter ----------------------------------------------------------------
function lerp(a, b, t) { return a + (b - a) * t }

function renderIcon(size) {
  const SS = 4 // supersample factor
  const W = size * SS
  const buf = Buffer.alloc(size * size * 4)

  // geometry helpers (supersampled grid)
  const cx = W / 2
  const cy = W / 2
  const radius = W * 0.44

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0, hits = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px * SS + sx + 0.5
          const y = py * SS + sy + 0.5
          const dx = x - cx
          const dy = y - cy
          const dist = Math.sqrt(dx * dx + dy * dy)

          let cr = 0x0b, cg = 0x10, cb = 0x20, ca = 0
          const insideRoundedSquare = Math.abs(dx) <= W * 0.47 && Math.abs(dy) <= W * 0.47 &&
            (Math.max(Math.abs(dx), Math.abs(dy)) <= W * 0.42 ||
             (Math.hypot(Math.abs(dx) - W * 0.42, Math.abs(dy) - W * 0.42) <= W * 0.06))
          if (insideRoundedSquare) {
            // vertical gradient backdrop #131a36 -> #0d1430
            const ty = (dy + W * 0.47) / (W * 0.94)
            cr = lerp(0x13, 0x0d, ty); cg = lerp(0x1a, 0x14, ty); cb = lerp(0x36, 0x30, ty)
            ca = 255
          }

          // outer ring stroke
          const ringDist = Math.abs(dist - radius)
          const halfStroke = Math.max(1.2, W * 0.035)
          if (ringDist <= halfStroke && dist <= W * 0.49) {
            cr = 0x81; cg = 0x8c; cb = 0xf8; ca = 255
          }

          // center core
          if (dist <= W * 0.075) {
            cr = 0xa5; cg = 0xb4; cb = 0xfc; ca = 255
          }

          // top-right sparkle
          const sparkDx = x - cx - W * 0.20
          const sparkDy = y - cy - W * 0.22
          const sparkDist = Math.hypot(sparkDx * 0.55, sparkDy)
          if (sparkDist <= W * 0.045) {
            const fade = 1 - sparkDist / (W * 0.045)
            cr = lerp(cr, 0xe0, fade); cg = lerp(cg, 0xe7, fade); cb = lerp(cb, 0xff, fade); ca = 255
          }

          r += cr; g += cg; b += cb; a += ca; hits++
        }
      }

      const idx = (py * size + px) * 4
      buf[idx] = Math.round(r / hits)
      buf[idx + 1] = Math.round(g / hits)
      buf[idx + 2] = Math.round(b / hits)
      buf[idx + 3] = Math.round(a / hits)
    }
  }
  return buf
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of [16, 48, 128]) {
  const png = encodePng(size, size, renderIcon(size))
  const outPath = join(OUT_DIR, `icon${size}.png`)
  writeFileSync(outPath, png)
  console.log(`wrote ${outPath} (${png.length} bytes)`)
}
