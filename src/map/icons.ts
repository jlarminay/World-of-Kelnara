// Map images (POI pins, settlement dots) are drawn on canvas at startup, so no sprite sheet is needed.
import type { IconNode } from 'lucide'
import { KINDS } from '@/world/categories'

const PR = 2 // pixel ratio the images are drawn at

export function iconSvg(icon: IconNode, color = 'currentColor', size = 24, strokeWidth = 2) {
  const body = icon
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
}

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}

function canvas(size: number) {
  const c = document.createElement('canvas')
  c.width = c.height = size * PR
  const ctx = c.getContext('2d')!
  ctx.scale(PR, PR)
  return { c, ctx }
}

/** Google-style POI badge: coloured circle, white outline, white glyph. */
async function pin(color: string, icon: IconNode) {
  const size = 24
  const { ctx } = canvas(size)
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.shadowColor = 'rgba(0,0,0,.3)'
  ctx.shadowBlur = 2
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#fff'
  ctx.stroke()
  const glyph = await loadSvg(iconSvg(icon, '#fff', 13 * PR, 2.4))
  ctx.drawImage(glyph, (size - 13) / 2, (size - 13) / 2, 13, 13)
  return ctx.getImageData(0, 0, size * PR, size * PR)
}

function dot(size: number, fill: string, ring: string, inner?: string) {
  const { ctx } = canvas(size)
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = ring
  ctx.stroke()
  if (inner) {
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 4 - 0.5, 0, Math.PI * 2)
    ctx.fillStyle = inner
    ctx.fill()
  }
  return ctx.getImageData(0, 0, size * PR, size * PR)
}

export async function buildImages() {
  const images: Record<string, ImageData> = {
    'dot-capital': dot(12, '#fff', '#3c4043', '#3c4043'),
    'dot-city': dot(9, '#fff', '#5f6368'),
    'dot-town': dot(7, '#fff', '#80868b'),
  }
  await Promise.all(Object.entries(KINDS).map(async ([kind, c]) => (images[`pin-${kind}`] = await pin(c.color, c.icon))))
  return { images, pixelRatio: PR }
}
