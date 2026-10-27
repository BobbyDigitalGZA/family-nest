// Regenerates the PWA icons from public/icons/source.svg: npm run icons
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../public/icons/', import.meta.url))
const targets = {
  'icon-192.png': 192,
  'icon-512.png': 512,
  'maskable-512.png': 512, // the source already keeps its mark in the safe zone
  'apple-touch-icon.png': 180,
}
for (const [name, size] of Object.entries(targets)) {
  await sharp(dir + 'source.svg', { density: 384 }).resize(size, size).png().toFile(dir + name)
  console.log('wrote', name)
}
