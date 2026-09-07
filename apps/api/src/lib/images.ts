import sharp from 'sharp'

export async function toWebp(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
}
