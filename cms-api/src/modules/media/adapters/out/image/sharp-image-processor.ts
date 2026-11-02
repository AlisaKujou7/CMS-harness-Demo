import sharp from 'sharp';
import type {
  ImageProcessor,
  ProcessedImage,
  ProcessedVariant,
} from '../../../application/ports/out/media-services.port.js';

// FR-MEDIA-05.
const VARIANTS = [
  { name: 'thumbnail', maxSize: 320 },
  { name: 'medium', maxSize: 1024 },
] as const;
// A small file can claim enormous dimensions, and decoding it would exhaust the worker's memory.
const MAX_INPUT_PIXELS = 100_000_000;

export class SharpImageProcessor implements ImageProcessor {
  async process(bytes: Uint8Array): Promise<ProcessedImage | null> {
    try {
      const input = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS });
      // Read from the header, so finding the size costs no memory. It accounts for rotation.
      const { autoOrient } = await input.metadata();
      const pipeline = input.clone().autoOrient();
      const variants = await Promise.all(
        VARIANTS.map(async ({ name, maxSize }): Promise<ProcessedVariant> => {
          const output = await pipeline
            .clone()
            .resize({
              width: maxSize,
              height: maxSize,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp()
            .toBuffer({ resolveWithObject: true });
          return { name, bytes: output.data, width: output.info.width, height: output.info.height };
        }),
      );
      return { width: autoOrient.width, height: autoOrient.height, variants };
    } catch {
      return null;
    }
  }
}
