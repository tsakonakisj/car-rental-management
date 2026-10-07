/**
 * Compresses an image File using canvas before upload.
 * - Resizes so the longest dimension never exceeds maxDim (default 1600px).
 * - Converts to JPEG at the given quality (default 0.8).
 * - Preserves aspect ratio.
 * - Returns a Blob (not the original File).
 */
export async function compressImage(
  file: File,
  maxDim: number = 1600,
  quality: number = 0.8
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let targetW = width;
  let targetH = height;

  if (width > height && width > maxDim) {
    targetW = maxDim;
    targetH = Math.round((height / width) * maxDim);
  } else if (height >= width && height > maxDim) {
    targetH = maxDim;
    targetW = Math.round((width / height) * maxDim);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Compression failed'));
      },
      'image/jpeg',
      quality
    );
  });
}
