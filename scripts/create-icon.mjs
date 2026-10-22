// 应用标识与界面使用同一款 Lucide Send 图标，离线生成 SVG、PNG 和 ICO。
import { writeFileSync, mkdirSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Send } from 'lucide-react'
import { Resvg } from '@resvg/resvg-js'

const mark = renderToStaticMarkup(
  createElement(Send, {
    x: 108,
    y: 108,
    width: 296,
    height: 296,
    color: '#fff',
    strokeWidth: 1.65,
  }),
)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs><linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6478f0"/><stop offset="1" stop-color="#4659ce"/></linearGradient></defs>
<rect width="512" height="512" rx="116" fill="url(#background)"/>
${mark}
</svg>`
const png = Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng())
const icoPng = Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: 256 } }).render().asPng())
const header = Buffer.alloc(22)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)
header.writeUInt16LE(1, 10)
header.writeUInt16LE(32, 12)
header.writeUInt32LE(icoPng.length, 14)
header.writeUInt32LE(22, 18)
mkdirSync('build', { recursive: true })
writeFileSync('build/icon.svg', svg)
writeFileSync('build/icon.png', png)
writeFileSync('build/icon.ico', Buffer.concat([header, icoPng]))
console.log('Lucide Send 应用图标已生成：SVG / 512px PNG / 256px ICO')
