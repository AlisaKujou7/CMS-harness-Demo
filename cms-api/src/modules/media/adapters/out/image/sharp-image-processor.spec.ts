import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { SharpImageProcessor } from './sharp-image-processor.js';

const processor = new SharpImageProcessor();
const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#336699' } });

describe('SharpImageProcessor (FR-MEDIA-05)', () => {
  it('makes a thumbnail within 320 and a medium within 1024, keeping the shape', async () => {
    const result = await processor.process(await image(2000, 1000).png().toBuffer());

    expect(result).toMatchObject({ width: 2000, height: 1000 });
    expect(result?.variants.map(({ name, width, height }) => ({ name, width, height }))).toEqual([
      { name: 'thumbnail', width: 320, height: 160 },
      { name: 'medium', width: 1024, height: 512 },
    ]);
  });

  it('writes WebP', async () => {
    const result = await processor.process(await image(50, 50).jpeg().toBuffer());

    const metadata = await sharp(result?.variants[0]?.bytes).metadata();
    expect(metadata.format).toBe('webp');
  });

  it('never enlarges a small image', async () => {
    const result = await processor.process(await image(100, 50).png().toBuffer());

    expect(result?.variants[1]).toMatchObject({ width: 100, height: 50 });
  });

  it('rasterizes an SVG', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><rect width="640" height="320" fill="#336699"/></svg>',
    );

    const result = await processor.process(svg);

    expect(result).toMatchObject({ width: 640, height: 320 });
    expect(result?.variants[0]).toMatchObject({ width: 320, height: 160 });
  });

  it('accounts for EXIF rotation', async () => {
    const rotated = await image(200, 100).withMetadata({ orientation: 6 }).jpeg().toBuffer();

    const result = await processor.process(rotated);

    expect(result).toMatchObject({ width: 100, height: 200 });
  });

  it('takes the first frame of a GIF', async () => {
    const result = await processor.process(await image(64, 64).gif().toBuffer());

    expect(result?.variants[0]).toMatchObject({ width: 64, height: 64 });
  });

  it('removes metadata such as location', async () => {
    const tagged = await image(50, 50)
      .withExif({ IFD3: { GPSLatitude: '1/1' } })
      .jpeg()
      .toBuffer();

    const result = await processor.process(tagged);

    expect((await sharp(result?.variants[0]?.bytes).metadata()).exif).toBeUndefined();
  });

  it('gives up on bytes that are not an image', async () => {
    await expect(processor.process(Buffer.from('not an image'))).resolves.toBeNull();
  });

  it('refuses an image that claims too many pixels', async () => {
    const huge = await sharp({
      create: { width: 12_000, height: 12_000, channels: 3, background: '#000' },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    await expect(processor.process(huge)).resolves.toBeNull();
  });
});
