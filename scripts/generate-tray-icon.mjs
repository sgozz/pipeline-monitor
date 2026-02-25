/**
 * Generate tray icon (template image for macOS: white on transparent).
 * Run: node scripts/generate-tray-icon.mjs
 */
import { createCanvas } from '@napi-rs/canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const buildDir = join(__dirname, '..', 'build')
mkdirSync(buildDir, { recursive: true })

function drawTrayIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const s = size / 16

  ctx.fillStyle = '#000000'

  // Draw a "J" shape — template images on macOS use black, the OS inverts for dark mode
  // Top bar of J
  ctx.fillRect(Math.round(3 * s), Math.round(1 * s), Math.round(10 * s), Math.round(3 * s))
  // Vertical stem
  ctx.fillRect(Math.round(8 * s), Math.round(1 * s), Math.round(3 * s), Math.round(10 * s))
  // Bottom curve
  ctx.fillRect(Math.round(3 * s), Math.round(10 * s), Math.round(8 * s), Math.round(3 * s))
  // Left hook
  ctx.fillRect(Math.round(3 * s), Math.round(8 * s), Math.round(3 * s), Math.round(4 * s))

  return canvas
}

// macOS tray icons: 16x16 (1x) and 32x32 (@2x)
for (const size of [16, 32]) {
  const canvas = drawTrayIcon(size)
  const suffix = size === 32 ? '@2x' : ''
  const png = canvas.toBuffer('image/png')
  writeFileSync(join(buildDir, `trayTemplate${suffix}.png`), png)
  console.log(`Generated trayTemplate${suffix}.png (${size}x${size})`)
}

console.log('Tray icons generated.')
