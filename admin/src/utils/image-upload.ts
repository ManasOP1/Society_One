const ACCEPTED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_DIMENSION = 320;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the logo file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not process the logo image."));
    image.src = src;
  });
}

/**
 * Resizes and compresses a society logo before it is stored in localStorage.
 * This keeps each society's settings small enough for the browser storage quota.
 */
export async function prepareSocietyLogo(file: File): Promise<string> {
  if (!ACCEPTED_LOGO_TYPES.has(file.type)) {
    throw new Error("Upload a PNG, JPG, or WebP image.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Logo must be smaller than 5 MB.");
  }

  const source = await readAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(
    1,
    MAX_LOGO_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable.");
  // JPEG has no alpha — fill white so transparent PNG logos don't go black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.82);
}
