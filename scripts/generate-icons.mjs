/**
 * Generate app icons in all required formats.
 * Run: node scripts/generate-icons.mjs
 */
import { createCanvas } from '@napi-rs/canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const buildDir = join(__dirname, '..', 'build')
mkdirSync(buildDir, { recursive: true })

function drawIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const s = size / 512 // scale factor

  // --- Background: rounded square ---
  const margin = 16 * s
  const radius = 96 * s
  const w = size - margin * 2

  // Dark gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, size, size)
  bgGrad.addColorStop(0, '#1e3a5f')
  bgGrad.addColorStop(1, '#0f172a')

  ctx.beginPath()
  ctx.roundRect(margin, margin, w, w, radius)
  ctx.fillStyle = bgGrad
  ctx.fill()

  // Subtle border
  ctx.beginPath()
  ctx.roundRect(margin + 8 * s, margin + 8 * s, w - 16 * s, w - 16 * s, radius - 8 * s)
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)'
  ctx.lineWidth = 2 * s
  ctx.stroke()

  // --- Letter J ---
  const jGrad = ctx.createLinearGradient(0, 120 * s, 0, 390 * s)
  jGrad.addColorStop(0, '#60a5fa')
  jGrad.addColorStop(1, '#3b82f6')
  ctx.fillStyle = jGrad

  ctx.beginPath()
  ctx.moveTo(190 * s, 120 * s)
  ctx.lineTo(340 * s, 120 * s)
  ctx.lineTo(340 * s, 168 * s)
  ctx.lineTo(288 * s, 168 * s)
  ctx.lineTo(288 * s, 310 * s)
  ctx.quadraticCurveTo(288 * s, 370 * s, 248 * s, 390 * s)
  ctx.quadraticCurveTo(208 * s, 410 * s, 168 * s, 390 * s)
  ctx.quadraticCurveTo(128 * s, 370 * s, 128 * s, 310 * s)
  ctx.lineTo(128 * s, 280 * s)
  ctx.lineTo(192 * s, 280 * s)
  ctx.lineTo(192 * s, 305 * s)
  ctx.quadraticCurveTo(192 * s, 335 * s, 215 * s, 345 * s)
  ctx.quadraticCurveTo(238 * s, 355 * s, 238 * s, 325 * s)
  ctx.lineTo(238 * s, 168 * s)
  ctx.lineTo(190 * s, 168 * s)
  ctx.closePath()
  ctx.fill()

  // --- Pipeline bar (3 connected stage dots) ---
  const pipeY = 430 * s
  const pipeGrad = ctx.createLinearGradient(130 * s, 0, 382 * s, 0)
  pipeGrad.addColorStop(0, '#22c55e')
  pipeGrad.addColorStop(0.5, '#3b82f6')
  pipeGrad.addColorStop(1, '#22c55e')

  ctx.beginPath()
  ctx.moveTo(150 * s, pipeY)
  ctx.lineTo(362 * s, pipeY)
  ctx.strokeStyle = pipeGrad
  ctx.lineWidth = 6 * s
  ctx.lineCap = 'round'
  ctx.stroke()

  // Stage dots
  const dots = [
    { x: 150, color: '#22c55e' },
    { x: 256, color: '#3b82f6' },
    { x: 362, color: '#22c55e' }
  ]
  for (const dot of dots) {
    ctx.beginPath()
    ctx.arc(dot.x * s, pipeY, 12 * s, 0, Math.PI * 2)
    ctx.fillStyle = dot.color
    ctx.fill()
  }

  return canvas
}

// Generate PNGs at all required sizes
const sizes = [16, 32, 48, 64, 128, 256, 512, 1024]

for (const size of sizes) {
  const canvas = drawIcon(size)
  const png = canvas.toBuffer('image/png')
  writeFileSync(join(buildDir, `icon_${size}.png`), png)
  console.log(`Generated icon_${size}.png`)
}

// Main icon.png (512x512 for Linux)
const mainCanvas = drawIcon(512)
writeFileSync(join(buildDir, 'icon.png'), mainCanvas.toBuffer('image/png'))
console.log('Generated icon.png (512x512)')

// 1024x1024 for macOS
const largeCanvas = drawIcon(1024)
writeFileSync(join(buildDir, 'icon_1024.png'), largeCanvas.toBuffer('image/png'))
console.log('Generated icon_1024.png')

console.log('\nPNG icons generated. Now creating ICO and ICNS...')
