/**
 * Нарезка общего снимка превью на карточки вариантов.
 * Координаты берём из png/metrics.json (их посчитала сама страница).
 *
 * Запуск: node brand/torlmud/tools/crop.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "..");
const PNG = path.join(DIR, "png");
const DSF = 2; // --force-device-scale-factor=2

const metrics = JSON.parse(fs.readFileSync(path.join(PNG, "metrics.json"), "utf8"));
const full = path.join(PNG, "preview-full.png");
const meta = await sharp(full).metadata();
console.log("полный снимок:", meta.width, "×", meta.height);

const jobs = [["tabs", "preview-header"], ...Object.keys(metrics.rects).filter((k) => k !== "tabs").map((k) => [k, `preview-${k.replace(/^c-/, "c-")}`])];

for (const [id, name] of jobs) {
  const r = metrics.rects[id];
  if (!r) continue;
  const pad = 14;
  const left = Math.max(0, Math.round((r.x - pad) * DSF));
  const top = Math.max(0, Math.round((r.y - pad) * DSF));
  const width = Math.min(meta.width - left, Math.round((r.w + pad * 2) * DSF));
  const height = Math.min(meta.height - top, Math.round((r.h + pad * 2) * DSF));
  const out = path.join(PNG, `${name}.png`);
  await sharp(full).extract({ left, top, width, height }).png({ compressionLevel: 9 }).toFile(out);
  console.log(" ", path.basename(out), `${width}×${height}`);
}
