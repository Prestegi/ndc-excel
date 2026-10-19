import type { BoundingBox } from '../types';

export function cropImageFromBox(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  box: BoundingBox | null | undefined,
  rotation: number = 0,
  insetPercent: number = 0
): string {
  if (!box) return '';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgWidth = sourceImage instanceof HTMLImageElement ? sourceImage.naturalWidth : sourceImage.width;
  const imgHeight = sourceImage instanceof HTMLImageElement ? sourceImage.naturalHeight : sourceImage.height;

  if (imgWidth === 0 || imgHeight === 0) return '';

  // Normalize coordinates from 0-1000 scale
  let ymin = Math.max(0, (box.ymin / 1000) * imgHeight);
  let xmin = Math.max(0, (box.xmin / 1000) * imgWidth);
  let ymax = Math.min(imgHeight, (box.ymax / 1000) * imgHeight);
  let xmax = Math.min(imgWidth, (box.xmax / 1000) * imgWidth);

  // Inset slightly if requested to strip surrounding printed black borders
  if (insetPercent > 0) {
    const insetX = ((xmax - xmin) * insetPercent) / 100;
    const insetY = ((ymax - ymin) * insetPercent) / 100;
    xmin = Math.min(xmax - 10, xmin + insetX);
    xmax = Math.max(xmin + 10, xmax - insetX);
    ymin = Math.min(ymax - 10, ymin + insetY);
    ymax = Math.max(ymin + 10, ymax - insetY);
  }

  const cropW = Math.max(10, xmax - xmin);
  const cropH = Math.max(10, ymax - ymin);

  // Set canvas size based on rotation
  const isRotated90or270 = rotation % 180 !== 0;
  canvas.width = Math.round(isRotated90or270 ? cropH : cropW);
  canvas.height = Math.round(isRotated90or270 ? cropW : cropH);

  ctx.save();
  // Move context to center for rotation
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);

  // Draw the cropped portion without distorting or retouching appearance
  ctx.drawImage(
    sourceImage,
    xmin,
    ymin,
    cropW,
    cropH,
    -cropW / 2,
    -cropH / 2,
    cropW,
    cropH
  );
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.95);
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for cropping: ' + String(e)));
    img.src = src;
  });
}
