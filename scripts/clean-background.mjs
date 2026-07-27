/**
 * Generates the production scene background from the approved reference artwork.
 *
 * The reference render has fake content baked into it: a video still inside the
 * television, five fake thumbnail cards in the queue recess, and a "カテゴリ"
 * drawer plaque. All three sit exactly where live overlays go, so they are
 * cleared here. Every other pixel is passed through untouched, which is what
 * keeps the approved composition intact.
 *
 * Regions are expressed in the design coordinate system (1586 x 992) that the
 * whole app uses -- see src/scene/designSystem.ts.
 *
 *   npm run clean:background
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const SOURCE = path.join(root, "assets/reference/selected-interface-reference.png");
const OUT_DIR = path.join(root, "src/assets/scene");
const OUT_WEBP = path.join(OUT_DIR, "entertainment-center-background.webp");
const OUT_PNG = path.join(OUT_DIR, "entertainment-center-background.png");

/** Regions cleared of baked-in fake content, in design pixels. */
const TELEVISION = { left: 508, top: 188, width: 630, height: 405 };
const QUEUE_RECESS = { left: 487, top: 654, width: 664, height: 114 };
const DRAWER_PLAQUE = { left: 218, top: 651, width: 110, height: 38 };

/** Points sampled from the source to pick fills that match their surroundings. */
const SAMPLES = {
  recess: [
    [1136, 700],
    [1140, 745],
    [495, 745],
  ],
  drawerWood: [
    [195, 668],
    [350, 668],
    [200, 700],
  ],
};

const svgRect = (r, body) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r.width}" height="${r.height}">${body}</svg>`,
  );

async function main() {
  const image = sharp(SOURCE);
  const meta = await image.metadata();
  if (meta.width !== 1586 || meta.height !== 992) {
    throw new Error(
      `Reference artwork is ${meta.width}x${meta.height}; the design canvas expects 1586x992. ` +
        `Update DESIGN_WIDTH/DESIGN_HEIGHT and every region in this script together.`,
    );
  }

  const { data, info } = await sharp(SOURCE).raw().toBuffer({ resolveWithObject: true });
  const sampleAvg = (points) => {
    const acc = [0, 0, 0];
    for (const [x, y] of points) {
      const i = (y * info.width + x) * info.channels;
      acc[0] += data[i];
      acc[1] += data[i + 1];
      acc[2] += data[i + 2];
    }
    return acc.map((v) => Math.round(v / points.length));
  };

  const recess = sampleAvg(SAMPLES.recess);
  const wood = sampleAvg(SAMPLES.drawerWood);
  const rgb = ([r, g, b]) => `rgb(${r},${g},${b})`;
  const shade = ([r, g, b], f) =>
    `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;

  console.log(`sampled queue recess ${rgb(recess)}, drawer wood ${rgb(wood)}`);

  // Television: a dark, faintly domed screen. Not flat black -- CRT glass keeps a
  // little bounce light in the corners, and a pure #000 rectangle reads as a hole.
  const tvFill = svgRect(
    TELEVISION,
    `<defs>
       <radialGradient id="g" cx="50%" cy="46%" r="72%">
         <stop offset="0%" stop-color="#14120f"/>
         <stop offset="62%" stop-color="#0b0a08"/>
         <stop offset="100%" stop-color="#050404"/>
       </radialGradient>
     </defs>
     <rect width="100%" height="100%" fill="url(#g)"/>`,
  );

  // Queue recess: flat shadowed wood with a soft inner shadow along the top edge,
  // so the cleared strip still reads as a recess rather than a painted panel.
  const queueFill = svgRect(
    QUEUE_RECESS,
    `<defs>
       <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0%" stop-color="${shade(recess, 0.62)}"/>
         <stop offset="18%" stop-color="${shade(recess, 0.9)}"/>
         <stop offset="88%" stop-color="${rgb(recess)}"/>
         <stop offset="100%" stop-color="${shade(recess, 0.78)}"/>
       </linearGradient>
     </defs>
     <rect width="100%" height="100%" fill="url(#v)"/>`,
  );

  // Drawer plaque: the "カテゴリ" brass label is replaced by the live transport row.
  const plaqueFill = svgRect(
    DRAWER_PLAQUE,
    `<defs>
       <linearGradient id="w" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0%" stop-color="${shade(wood, 1.04)}"/>
         <stop offset="100%" stop-color="${shade(wood, 0.9)}"/>
       </linearGradient>
     </defs>
     <rect width="100%" height="100%" fill="url(#w)"/>`,
  );

  const composited = sharp(SOURCE).composite([
    { input: tvFill, left: TELEVISION.left, top: TELEVISION.top },
    { input: queueFill, left: QUEUE_RECESS.left, top: QUEUE_RECESS.top },
    { input: plaqueFill, left: DRAWER_PLAQUE.left, top: DRAWER_PLAQUE.top, blend: "over" },
  ]);

  // The plaque patch has a hard edge against the wood grain. A 6px blur confined
  // to a slightly larger patch feathers it without touching the rest of the scene.
  const feathered = await composited.png().toBuffer();
  const patch = await sharp(feathered)
    .extract({
      left: DRAWER_PLAQUE.left - 8,
      top: DRAWER_PLAQUE.top - 8,
      width: DRAWER_PLAQUE.width + 16,
      height: DRAWER_PLAQUE.height + 16,
    })
    .blur(5)
    .toBuffer();

  const final = sharp(feathered).composite([
    { input: patch, left: DRAWER_PLAQUE.left - 8, top: DRAWER_PLAQUE.top - 8 },
  ]);

  await final.clone().webp({ quality: 92, effort: 6 }).toFile(OUT_WEBP);
  await final.clone().png({ compressionLevel: 9 }).toFile(OUT_PNG);

  console.log(`wrote ${path.relative(root, OUT_WEBP)}`);
  console.log(`wrote ${path.relative(root, OUT_PNG)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
