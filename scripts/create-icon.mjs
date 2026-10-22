// 以同一组简单几何图形生成跨平台 PNG 和 Windows ICO，不依赖外部绘图工具。
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
const size = 256,
  pixels = Buffer.alloc((size * 4 + 1) * size)
function segment(x, y, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)
}
const lines = [
  [
    [76, 180],
    [180, 76],
  ],
  [
    [104, 76],
    [180, 76],
  ],
  [
    [180, 76],
    [180, 152],
  ],
]
for (let y = 0; y < size; y++)
  for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0, 0]
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) {
        const px = x + (a + 0.5) / 4,
          py = y + (b + 0.5) / 4,
          cx = Math.max(60, Math.min(196, px)),
          cy = Math.max(60, Math.min(196, py))
        if (Math.hypot(px - cx, py - cy) > 60) continue
        const white = lines.some(([start, end]) => segment(px, py, start, end) < 9),
          color = white ? [255, 255, 255] : [79, 111, 223]
        for (let c = 0; c < 3; c++) sum[c] += color[c]
        sum[3] += 255
      }
    const index = y * (size * 4 + 1) + 1 + x * 4
    for (let c = 0; c < 4; c++) pixels[index + c] = Math.round(sum[c] / 16)
  }
function crc32(data) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(name, data) {
  const type = Buffer.from(name),
    length = Buffer.alloc(4),
    crc = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])))
  return Buffer.concat([length, type, data, crc])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(size)
ihdr.writeUInt32BE(size, 4)
ihdr[8] = 8
ihdr[9] = 6
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(pixels)),
  chunk('IEND', Buffer.alloc(0)),
])
const header = Buffer.alloc(22)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)
header.writeUInt16LE(1, 10)
header.writeUInt16LE(32, 12)
header.writeUInt32LE(png.length, 14)
header.writeUInt32LE(22, 18)
mkdirSync('build', { recursive: true })
writeFileSync('build/icon.png', png)
writeFileSync('build/icon.ico', Buffer.concat([header, png]))
console.log('图标已生成：256px PNG / ICO')
