/**
 * Helper to crop a bounding box region from an image data URL
 * @param dataUrl Base64 or Blob image URL
 * @param box2d Bounding box [ymin, xmin, ymax, xmax] normalized to 0..1000 scale
 * @param paddingRatio Optional padding ratio around bounding box (default 0 for manual precision)
 * @returns Base64 PNG data URL of the cropped region
 */
export async function cropImageBoundingBox(
  dataUrl: string,
  box2d: [number, number, number, number] | number[],
  paddingRatio: number = 0
): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(dataUrl);
      return;
    }

    if (!dataUrl || !box2d || !Array.isArray(box2d) || box2d.length !== 4) {
      resolve(dataUrl);
      return;
    }

    const [ymin, xmin, ymax, xmax] = box2d;

    // Validate bounds
    if (ymin >= ymax || xmin >= xmax || ymax <= 0 || xmax <= 0) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const width = img.width;
        const height = img.height;

        // Convert 0..1000 scale to actual image pixel coordinates
        const padX = Math.round(width * Math.max(0, paddingRatio));
        const padY = Math.round(height * Math.max(0, paddingRatio));

        const cropX = Math.max(0, Math.round((xmin / 1000) * width) - padX);
        const cropY = Math.max(0, Math.round((ymin / 1000) * height) - padY);
        const cropW = Math.min(width - cropX, Math.round(((xmax - xmin) / 1000) * width) + padX * 2);
        const cropH = Math.min(height - cropY, Math.round(((ymax - ymin) / 1000) * height) + padY * 2);

        if (cropW <= 5 || cropH <= 5) {
          resolve(dataUrl);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Use high quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const croppedUrl = canvas.toDataURL('image/png');
        resolve(croppedUrl);
      } catch (err) {
        console.error('Error cropping image bounding box:', err);
        resolve(dataUrl);
      }
    };

    img.onerror = () => {
      resolve(dataUrl);
    };

    img.src = dataUrl;
  });
}
