/**
 * Polyfill for DOM APIs required by pdfjs-dist in Node.js environment
 * This file must be imported before any pdfjs-dist usage
 */

try {
  // Import canvas only if it is installed locally.
  // The backend can still start without it; pdf rendering just won't use this path.
  let createCanvas: ((width: number, height: number) => { getContext: (type: string) => any }) | null = null;
  try {
    ({ createCanvas } = require("canvas"));
  } catch (canvasErr) {
    const code = (canvasErr as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "MODULE_NOT_FOUND") {
      throw canvasErr;
    }

    process.stderr.write("[Polyfill] canvas package not installed, skipping optional DOM shims\n");
  }

  // Set up global canvas context if not already available
  if (createCanvas && typeof (globalThis as any).DOMMatrix === "undefined") {
    // Create a dummy canvas to get context with DOMMatrix support
    const canvas = createCanvas(1, 1);
    const ctx = canvas.getContext("2d");
    
    // Expose necessary DOM classes to global scope
    if (ctx && typeof ctx.constructor !== "undefined") {
      (globalThis as any).DOMMatrix = class DOMMatrix {
        constructor(
          public m11 = 1,
          public m12 = 0,
          public m21 = 0,
          public m22 = 1,
          public m41 = 0,
          public m42 = 0
        ) {}
      };
    }
  }

  if (typeof (globalThis as any).ImageData === "undefined") {
    (globalThis as any).ImageData = class ImageData {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number
      ) {}
    };
  }

  if (typeof (globalThis as any).Path2D === "undefined") {
    (globalThis as any).Path2D = class Path2D {
      constructor() {}
    };
  }

  process.stderr.write("[Polyfill] DOM APIs loaded successfully for pdfjs-dist\n");
} catch (err) {
  console.warn("[Polyfill] Canvas polyfill failed (non-critical):", err);
}
