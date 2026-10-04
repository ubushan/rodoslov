/**
 * Выгрузка готовых растровых файлов для сайта: иконки, favicon, OG-картинка.
 *
 * Все исходники — SVG с переведённой в кривые надписью, поэтому sharp
 * (librsvg) рисует их без установленных шрифтов.
 *
 * Запуск: node brand/torlmud/tools/export.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "..");
const OUT = path.join(DIR, "export");
fs.mkdirSync(OUT, { recursive: true });

const read = (p) => fs.readFileSync(path.join(DIR, "svg", p));
const raster = (buf, size) => sharp(buf, { density: 480 }).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 });

// 1. Иконки приложения и apple-touch-icon: знак на белом скруглённом поле.
for (const size of [180, 192, 512]) {
  await raster(read("tile-512.svg"), size).toFile(path.join(OUT, `icon-${size}.png`));
}

// 2. Иконка вкладки: тот же значок в прозрачном квадрате.
for (const size of [16, 32, 48]) {
  await raster(read("favicon.svg"), size).toFile(path.join(OUT, `favicon-${size}.png`));
}

// 3. OG-картинка 1200×630 — вертикальный штамп по центру.
const OG = { width: 1200, height: 630 };
for (const [name, bg, file] of [
  ["og-dark.png", "#0f172a", "lockup/pick-stacked-dark.svg"],
  ["og-light.png", "#f1f3f5", "lockup/pick-stacked.svg"],
]) {
  const logo = await sharp(read(file), { density: 300 }).resize({ width: 420 }).png().toBuffer();
  await sharp({ create: { ...OG, channels: 4, background: bg } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, name));
}

// 4. Плашка шапки: знак на тёмной подложке, как в текущем интерфейсе.
const tileDark = await sharp(read("tile-dark-512.svg"), { density: 300 }).resize(72, 72).png().toBuffer();
await sharp({ create: { width: 72, height: 72, channels: 4, background: "#0f172a" } })
  .composite([{ input: tileDark, gravity: "center" }])
  .png()
  .toFile(path.join(OUT, "tile-dark-72.png"));

for (const f of fs.readdirSync(OUT).sort()) {
  const s = fs.statSync(path.join(OUT, f));
  console.log("  ", f, `${Math.round(s.size / 1024)} КБ`);
}
