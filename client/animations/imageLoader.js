export function loadImage(src) {
  console.log(`ImageLoader: Attempting to load image from ${src}`);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      console.log(`ImageLoader: Image loaded successfully from ${src}`);
      console.log(`Image dimensions: ${img.width}x${img.height}`);
      resolve(img);
    };
    img.onerror = (err) => {
      console.error(`ImageLoader: Failed to load image from ${src}:`, err);
      reject(err);
    };
    img.src = src;
  });
}