/**
 * Torlmud — генератор логотипа.
 *
 * Что делает:
 *   1. Переводит надпись «Torlmud» из шрифтов Literata / Golos Text в кривые
 *      (opentype.js), чтобы логотип был автономным: файл открывается где угодно
 *      без установленных шрифтов и без веб-запроса.
 *   2. Рисует знаки на сетке 24×24 и собирает все файлы в brand/torlmud/svg.
 *   3. Собирает страницу превью brand/torlmud/index.html — знак в шапке сайта,
 *      на тёмной обложке, в размерах 128/64/32/16 и в одном цвете.
 *
 * Палитра взята из src/app/globals.css (светлая тема):
 *   чернила #0f172a, латунь #a16207, фон обложки #0f172a, текст на обложке #f2f5fa.
 *
 * Запуск: node brand/torlmud/tools/build.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SVG_DIR = path.join(ROOT, "svg");
const LOCKUP_DIR = path.join(SVG_DIR, "lockup");

const INK = "#0f172a";
const INK_MUTED = "#55637a";
const BRASS = "#a16207";
const BRASS_DARK = "#d3ab35";
const ALBUM_TEXT = "#f2f5fa";
const ALBUM_MUTED = "#94a3b8";

const STROKE = 1.7; // базовый штрих на сетке 24×24
const BOLD = 2.3; // утолщение для мелких размеров (16–24 px)

/* ------------------------------------------------------------------ */
/* Шрифты и перевод надписи в кривые                                   */
/* ------------------------------------------------------------------ */

const fontCache = new Map();
function loadFont(file) {
  if (!fontCache.has(file)) {
    fontCache.set(file, opentype.parse(fs.readFileSync(path.join(ROOT, "fonts", file))));
  }
  return fontCache.get(file);
}

/** Раскладывает строку по глифам с кернингом и трекингом. */
function typeset(font, text, size, tracking = 0) {
  const scale = size / font.unitsPerEm;
  let x = 0;
  let prev = null;
  const parts = [];
  for (const ch of text) {
    const glyph = font.glyphs.get(font.charToGlyphIndex(ch));
    if (!glyph || glyph.index === 0) throw new Error(`нет глифа «${ch}» в шрифте`);
    if (prev) x += font.getKerningValue(prev, glyph) * scale;
    // opentype.js на некоторых дробных x выдаёт NaN в одном из узлов контура
    // (проверено на Literata «d»). Сдвигаем глиф на доли пикселя, пока путь чист.
    let placed = glyph.getPath(x, 0, size);
    for (let nudge = 0; nudge < 24 && placed.toPathData(2).includes("NaN"); nudge++) {
      placed = glyph.getPath(x + 0.013 * (nudge + 1), 0, size);
    }
    const d = placed.toPathData(2);
    if (d.includes("NaN")) throw new Error(`путь глифа «${ch}» не строится без NaN`);
    const p = { d, getBoundingBox: () => placed.getBoundingBox() };
    const bb = placed.getBoundingBox();
    parts.push({ d, bb });
    x += glyph.advanceWidth * scale + tracking;
    prev = glyph;
  }
  const bb = parts.reduce(
    (acc, p) => ({
      x1: Math.min(acc.x1, p.bb.x1),
      y1: Math.min(acc.y1, p.bb.y1),
      x2: Math.max(acc.x2, p.bb.x2),
      y2: Math.max(acc.y2, p.bb.y2),
    }),
    { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity },
  );
  return { d: parts.map((p) => p.d).join(" "), bb, advance: x - tracking };
}

const WORDS = {
  // Основная надпись: Torlmud — так же, как домен torlmud.ru и как в коде сайта.
  title: "Torlmud",
  // Строчная — запасной вариант, ближе к адресу сайта.
  lower: "torlmud",
  // Подпись для подвала и обложки: калмыцкое слово и перевод.
  tagline: "төрлмүд · родственники",
};

const fonts = {
  literata: "Literata-Medium.ttf",
  golos: "GolosText-Medium.ttf",
};

/* ------------------------------------------------------------------ */
/* Шесть знаков                                                        */
/* ------------------------------------------------------------------ */
/*
 * Знак описывается списком примитивов на сетке 24×24 (безопасное поле 2…22):
 *   { line: "M…" }              — штрих текущим цветом
 *   { line: "M…", accent: true } — штрих латунью
 *   { dot: [cx, cy, r] }        — залитый круг
 *   { dot: [cx, cy, r], accent: true }
 */

const MARKS = [
  {
    id: "tamga",
    name: "Тамга",
    idea: "Родовое клеймо и буква T в одном знаке",
    note: "Тамга у ойратов метила скот, бирки и дверные пологи и была знаком конкретного рода. Здесь это собственная монограмма в тамговой геометрии: перекладина, ствол, раздвоенное основание (по типу формы «гулз» — рога) и узел в развилке. Чужую родовую тамгу мы не берём: тамга — маркер конкретного рода, а не общий символ.",
    primitives: [
      { line: "M5.2 6.3H18.8" },
      { line: "M12 6.3V14.9" },
      { line: "M12 14.9 9.8 17.1M12 14.9l2.2 2.2" },
      { dot: [12, 13.4, 1.5], accent: true },
    ],
  },
  {
    id: "yurt",
    name: "Гер (юрта)",
    idea: "Дом и очаг: место, где род собирается",
    note: "Купол, верхний круг харач и разрыв в основании — проём двери үүдн. Пять линий, читается даже в 16 px. Бонус: силуэт почти совпадает с изолированной буквой «т» (Ta) в тодо бичиг — знак работает и как дом, и как письмо.",
    primitives: [
      { line: "M5 17a7 7 0 0 1 3.5-6.06" },
      { line: "M15.5 10.94A7 7 0 0 1 19 17" },
      { line: "M3.6 17h6.8M13.6 17h6.8" },
      { dot: [12, 10.6, 1.6], accent: true },
    ],
  },
  {
    id: "todo-line",
    name: "Строка (тодо бичиг)",
    idea: "Память рода, записанная вертикальными строками",
    note: "По мотивам начальной буквы «о» тодо бичиг: ствол, крюк-язычок вверху справа, перекладина с заострённым левым концом, петля-чаша слева и длинный хвост вправо-вниз. Знак живёт от 32 px — в 16 px он читается как росчерк, а не как буква; показывайте носителю языка.",
    dx: 0.7,
    dy: 0,
    primitives: [
      { line: "M12 5.4v11.2" },
      { line: "M12 5.4c0-1.5 1.6-2.1 2.7-1.1" },
      { fill: "M5.2 9.6 6.7 8.7v1.8L5.2 9.6Z" },
      { line: "M6.7 9.6H12" },
      { line: "M12 11.6c-5 0-5 4.8 0 4.8", accent: true },
      { line: "M12 16.6c.6 2.2 2.6 3.2 5.2 2.6" },
    ],
  },
  {
    id: "spiral",
    name: "Спираль рода",
    idea: "Нить от предка расходится к потомкам",
    note: "Бегущая спираль — из того же геометрического словаря, что тамги и зег: сплошная линия без начала и конца, которая разворачивается от точки в середине. Латунная точка в центре — общий предок. Как и «Строка», это знак для 32 px и больше.",
    primitives: [
      { line: "M19 19H5V5h14v10.6H8.4V8.4h7.2V12H12" },
      { dot: [12, 12, 1.35], accent: true },
    ],
  },
  {
    id: "tulip",
    name: "Тюльпан",
    idea: "Степь и весна: цветение рода",
    note: "Тюльпан — устойчивый символ калмыцкой степи. Три лепестка на стебле и линия земли. Стебель можно использовать как декоративную линию в подвале сайта.",
    primitives: [
      {
        line:
          "M12 13.2C8.5 12 7.1 9.3 7.5 5.0c2.2 1.2 3.5 2.8 4.5 4.8 1-2 2.3-3.6 4.5-4.8.4 4.3-1 7-4.5 8.2Z",
      },
      { line: "M12 13.2v6.4" },
      { line: "M7.4 20.9h9.2" },
    ],
  },
  {
    id: "nodes",
    name: "Узлы и связи",
    idea: "Прямая метафора сервиса: люди-узлы и связи между ними",
    note: "Знак повторяет язык холста древа: круглый узел и плавная связь. Легче всех масштабируется и лучше всех читается в интерфейсе — но ничего не говорит о Калмыкии.",
    primitives: [
      { dot: [12, 6.3, 2.2] },
      { dot: [5.6, 17.7, 2.2] },
      { dot: [18.4, 17.7, 2.2] },
      { line: "M12 8.5C12 12.7 5.6 11.5 5.6 15.5" },
      { line: "M12 8.5c0 4.2 6.4 3 6.4 7" },
    ],
  },
];

/* Компактная спираль для 16–24 px: полная (шаг 3.4) на таком размере сливается
   в пятно, поэтому витков меньше, а шаг между ними 6.0. У неё же толще штрих.
   Идёт в иконку вкладки, иконки приложения и плитку в шапке. */
const SPIRAL_COMPACT = {
  ...MARKS.find((m) => m.id === "spiral"),
  id: "spiral-compact",
  name: "Спираль рода (для малых размеров)",
  primitives: [
    { line: "M3 3H21V21H3V9H15V15H9V12H12" },
    { dot: [12, 12, 1.7], accent: true },
  ],
};

/* Мотивы, которые сознательно не взяты — с причиной. */
const REJECTED = [
  ["Четыре скреплённых круга", "Символ Дөрвөн Ойрад, но он стоит в гербе Калмыкии: использование госсимволики в нарушение правил — административное правонарушение (ст. 19 КоАП РК, закон 44-I-З)."],
  ["Хас (свастика)", "Реальная форма тамги и буддийский благопожелательный знак, но в светском контексте читается как нацистская свастика."],
  ["Лотос из девяти лепестков", "Элемент флага Калмыкии; лотос вообще — священный цветок (бадм цецг), ему не место в товарном знаке."],
  ["Хадак, чётки, тханки, изображения будд", "Культовые предметы и изображения: декором в логотипе быть не должны."],
  ["Конкретная чужая тамга", "Тамга — маркер конкретного рода; взять её как «общий калмыцкий» знак значит исказить смысл."],
];

/** Собирает тело знака. mode: mono | color | adaptive; weight: base | bold */
function markBody(mark, { mode = "mono", weight = "base" } = {}) {
  const sw = weight === "bold" ? BOLD : STROKE;
  // В adaptive-режиме цвета живут в CSS-переменных: тогда один файл годится и
  // для светлой, и для тёмной вкладки браузера.
  const ink = mode === "mono" ? "currentColor" : mode === "adaptive" ? "var(--i, currentColor)" : INK;
  const accent =
    mode === "mono" ? "currentColor" : mode === "adaptive" ? "var(--a, currentColor)" : BRASS;
  const inkFill = mode === "adaptive" ? "var(--if, currentColor)" : ink;
  const accentFill = mode === "adaptive" ? "var(--af, currentColor)" : accent;
  const out = [];

  for (const p of mark.primitives) {
    if (p.line) {
      out.push(
        `<path d="${p.line}" stroke="${p.accent ? accent : ink}"/>`,
      );
    } else if (p.fill) {
      out.push(`<path d="${p.fill}" fill="${p.accent ? accentFill : inkFill}"/>`);
    } else if (p.dot) {
      const [cx, cy, r] = p.dot;
      if (p.ring) {
        out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${p.accent ? accent : ink}"/>`);
      } else {
        out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.accent ? accentFill : inkFill}"/>`);
      }
    }
  }
  return `<g fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${
    mark.dx || mark.dy ? ` transform="translate(${mark.dx || 0} ${mark.dy || 0})"` : ""
  }>\n    ${out.join("\n    ")}\n  </g>`;
}

/** Стиль для автономного favicon: цвета меняются вместе со схемой браузера. */
const ADAPTIVE_STYLE = `<style>
    svg { --i: ${INK}; --a: ${BRASS}; --if: ${INK}; --af: ${BRASS} }
    @media (prefers-color-scheme: dark) { svg { --i: ${ALBUM_TEXT}; --a: ${BRASS_DARK}; --if: ${ALBUM_TEXT}; --af: ${BRASS_DARK} } }
  </style>`;

function iconSvg(mark, opts = {}) {
  const { size, mode = "mono", weight = "base", title } = opts;
  const dim = size ? ` width="${size}" height="${size}"` : "";
  const label = title ?? `Torlmud — ${mark.name}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"${dim} fill="none" role="img" aria-label="${label}">
  <title>${label}</title>${mode === "adaptive" ? `\n  ${ADAPTIVE_STYLE}` : ""}
  ${markBody(mark, { mode, weight })}
</svg>
`;
}

/* ------------------------------------------------------------------ */
/* Лок-апы: знак + надпись кривыми                                     */
/* ------------------------------------------------------------------ */

const MARK_BOX = 32; // знак в лок-апе
const GAP = 10; // просвет между знаком и надписью

function lockupSvg(mark, { font = "literata", word = "title", tone = "light", weight = "base" } = {}) {
  const f = loadFont(fonts[font]);
  const text = WORDS[word];
  const fs_ = word === "tagline" ? 13 : 21;
  const t = typeset(f, text, fs_, word === "tagline" ? 0.2 : -0.35);

  const markInk = tone === "dark" ? ALBUM_TEXT : INK;
  const markAccent = tone === "dark" ? BRASS_DARK : BRASS;

  // Надпись центрируем по чернильному прямоугольнику относительно центра знака.
  const x = MARK_BOX + GAP;
  const dy = MARK_BOX / 2 - (t.bb.y1 + t.bb.y2) / 2;
  const width = Math.ceil(x + t.bb.x2 + 2);
  const height = MARK_BOX;

  // mono-версия красит всё в currentColor, поэтому берём color-раскладку и
  // подменяем два исходных цвета на цвета нужного тона.
  const toned = markBody(mark, { mode: "color", weight })
    .split(INK)
    .join(markInk)
    .split(BRASS)
    .join(markAccent);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none" role="img" aria-label="Torlmud — ${mark.name}">
  <title>Torlmud — ${mark.name}</title>
  <g transform="scale(${(MARK_BOX / 24).toFixed(4)})">
    ${toned}
  </g>
  <g transform="translate(${x} ${dy.toFixed(2)})">
    <path d="${t.d}" fill="${markInk}"/>
  </g>
</svg>
`;
}

/** Вертикальный штамп: знак, под ним надпись и подпись — для подвала и OG-картинки. */
function stackedSvg(mark, { tone = "light", word = "title", tagline = true } = {}) {
  const fl = loadFont(fonts.literata);
  const fg = loadFont(fonts.golos);
  const w1 = typeset(fl, WORDS[word], 23, -0.3);
  const w2 = tagline ? typeset(fg, WORDS.tagline, 12, 0.25) : null;

  const ink = tone === "dark" ? ALBUM_TEXT : INK;
  const accent = tone === "dark" ? BRASS_DARK : BRASS;

  const top = 48; // верх надписи под знаком
  const h1 = w1.bb.y2 - w1.bb.y1;
  const h2 = w2 ? w2.bb.y2 - w2.bb.y1 : 0;
  const W = Math.ceil(Math.max(MARK_BOX, w1.bb.x2 - w1.bb.x1, w2 ? w2.bb.x2 - w2.bb.x1 : 0) + 8);
  const H = Math.ceil(top + h1 + (w2 ? 9 + h2 : 0) + 4);

  const centre = (bb) => (W - (bb.x2 - bb.x1)) / 2 - bb.x1;

  const body = markBody(mark, { mode: "color" }).split(INK).join(ink).split(BRASS).join(accent);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none" role="img" aria-label="Torlmud">
  <title>Torlmud — ${mark.name}</title>
  <g transform="translate(${((W - MARK_BOX) / 2).toFixed(2)} 0) scale(${(MARK_BOX / 24).toFixed(4)})">
    ${body}
  </g>
  <g transform="translate(${centre(w1.bb).toFixed(2)} ${(top - w1.bb.y1).toFixed(2)})">
    <path d="${w1.d}" fill="${ink}"/>
  </g>
  ${w2 ? `<g transform="translate(${centre(w2.bb).toFixed(2)} ${(top + h1 + 9 - w2.bb.y1).toFixed(2)})">
    <path d="${w2.d}" fill="${tone === "dark" ? ALBUM_MUTED : INK_MUTED}"/>
  </g>` : ""}
</svg>
`;
}


/** Автономный знак в квадрате — для favicon, иконки приложения и OG-картинки. */
function tileSvg(mark, { size = 512, bg = "#ffffff", ink = INK, accent = BRASS, weight = "base", radius = 112 } = {}) {
  const s = size / 24;
  // Цвета знака задаются отдельно от фона: на тёмной плитке чернила не видны.
  const body = markBody(mark, { mode: "color", weight }).split(INK).join(ink).split(BRASS).join(accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>
  <g transform="translate(${(size - 20 * s) / 2} ${(size - 20 * s) / 2}) scale(${(20 * s) / 24})" >
    ${body}
  </g>
</svg>
`;
}

/* ------------------------------------------------------------------ */
/* Запись файлов                                                       */
/* ------------------------------------------------------------------ */

fs.rmSync(SVG_DIR, { recursive: true, force: true });
fs.mkdirSync(LOCKUP_DIR, { recursive: true });

const write = (dir, name, content) => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return path.relative(ROOT, file);
};

const written = [];
for (const mark of MARKS) {
  written.push(write(SVG_DIR, `${mark.id}.svg`, iconSvg(mark)));
  written.push(write(SVG_DIR, `${mark.id}-bold.svg`, iconSvg(mark, { weight: "bold" })));
  written.push(write(SVG_DIR, `${mark.id}-color.svg`, iconSvg(mark, { mode: "color", size: 32 })));
  written.push(write(LOCKUP_DIR, `${mark.id}-literata.svg`, lockupSvg(mark, { font: "literata" })));
  written.push(write(LOCKUP_DIR, `${mark.id}-golos.svg`, lockupSvg(mark, { font: "golos" })));
  written.push(write(LOCKUP_DIR, `${mark.id}-dark.svg`, lockupSvg(mark, { font: "literata", tone: "dark" })));
}

// Рекомендованный знак — отдельным набором для favicon.
const pick = process.env.TURLMUD_PICK || "spiral";
const picked = MARKS.find((m) => m.id === pick) || MARKS[0];
// Мелкие размеры — компактная спираль, крупные (лок-ап, штамп) — полная.
const iconMark = process.env.TURLMUD_ICON === "full" ? picked : SPIRAL_COMPACT;
const iconAdaptive = iconSvg(iconMark, { mode: "adaptive", weight: "bold" });
written.push(write(SVG_DIR, "icon.svg", iconAdaptive));
written.push(write(SVG_DIR, "favicon.svg", iconAdaptive));
written.push(write(SVG_DIR, "spiral-compact.svg", iconSvg(SPIRAL_COMPACT)));
written.push(write(SVG_DIR, "spiral-compact-bold.svg", iconSvg(SPIRAL_COMPACT, { weight: "bold" })));
written.push(write(SVG_DIR, "spiral-compact-color.svg", iconSvg(SPIRAL_COMPACT, { mode: "color", size: 32 })));
written.push(write(SVG_DIR, "tile-512.svg", tileSvg(iconMark, { size: 512 })));
written.push(write(SVG_DIR, "tile-dark-512.svg", tileSvg(iconMark, { size: 512, bg: "#0f172a", ink: ALBUM_TEXT, accent: BRASS_DARK, weight: "bold" })));
written.push(write(LOCKUP_DIR, "pick-stacked.svg", stackedSvg(picked)));
written.push(write(LOCKUP_DIR, "pick-stacked-dark.svg", stackedSvg(picked, { tone: "dark" })));

/* ------------------------------------------------------------------ */
/* Страница превью                                                     */
/* ------------------------------------------------------------------ */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function conceptCard(mark) {
  const sizes = [128, 64, 40, 32, 24, 16];
  const sizeRow = sizes
    .map(
      (s) =>
        `<figure class="size"><div class="size__box" style="width:${s + 16}px;height:${s + 16}px">${iconSvg(mark, { size: s, mode: "color", weight: s <= 24 ? "bold" : "base" }).replace(/^<svg[^>]*>/, (m0) => m0.replace(/\n\s*<title>.*<\/title>/, ""))}</div><figcaption>${s} px</figcaption></figure>`,
    )
    .join("\n        ");

  return `<section class="card" id="c-${mark.id}">
      <header class="card__head">
        <div>
          <p class="eyebrow">Вариант ${MARKS.indexOf(mark) + 1}</p>
          <h2>${esc(mark.name)}</h2>
          <p class="idea">${esc(mark.idea)}</p>
        </div>
        <div class="pick">${mark.id === pick ? "рекомендую" : ""}</div>
      </header>

      <div class="stage">
        <div class="stage__light">
          <p class="stage__label">Светлая тема · знак и лок-ап</p>
          <div class="stage__row">
            <span class="mark-lg">${iconSvg(mark, { size: 72, mode: "color" })}</span>
            <span class="lockup-lg">${lockupSvg(mark, { tone: "light" }).replace(/^<svg /, '<svg class="lockup" ')}</span>
          </div>
          <p class="stage__sub">Второй шрифт надписи — Golos Text</p>
          <div class="stage__row stage__row--tight">${lockupSvg(mark, { font: "golos", tone: "light" }).replace(/^<svg /, '<svg class="lockup" ')}</div>
        </div>

        <div class="stage__dark">
          <p class="stage__label">Тёмная обложка сайта</p>
          <div class="stage__row">
            <span class="mark-lg">${iconSvg(mark, { size: 72, mode: "mono" }).replace(/^(<svg[^>]*)>/, '$1 style="color:#d3ab35">')}</span>
            <span class="lockup-lg">${lockupSvg(mark, { tone: "dark" }).replace(/^<svg /, '<svg class="lockup" ')}</span>
          </div>
        </div>
      </div>

      <div class="sizes">
        <p class="stage__label">Как читается в малом размере (с утолщением штриха)</p>
        <div class="sizes__row">
        ${sizeRow}
        </div>
      </div>

      <p class="note">${esc(mark.note)}</p>
    </section>`;
}

const headerMock = (mark, tone, kind = "tile") => {
  // kind="tile" — как в текущей шапке сайта: знак в квадратной плашке + надпись.
  // kind="lockup" — готовый лок-ап без плашки.
  const brand =
    kind === "tile"
      ? `<span class="mock__tile">${iconSvg(mark, { size: 22, mode: tone === "dark" ? "mono" : "color", weight: "bold" }).replace(
          /^(<svg[^>]*)>/,
          tone === "dark" ? '$1 style="color:#d3ab35">' : "$1>",
        )}</span><span class="mock__name">Torlmud</span>`
      : lockupSvg(mark, { tone }).replace(/^<svg /, '<svg class="lockup lockup--mock" ');

  return `<div class="mock mock--${tone}">
      <div class="mock__bar">
        <div class="mock__brand">${brand}</div>
        <nav class="mock__nav"><span>Как устроено</span><span>Карточка</span><span class="mock__cta">Создать древо</span></nav>
      </div>
    </div>`;
};

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Torlmud — логотип</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @font-face { font-family: Literata; src: url("fonts/Literata-Medium.ttf") format("truetype"); font-weight: 500; }
  @font-face { font-family: "Golos Text"; src: url("fonts/GolosText-Medium.ttf") format("truetype"); font-weight: 500; }

  :root {
    --ink-900:#060b16; --ink-800:#0f172a; --ink-700:#1e293b; --ink-500:#4f5d73; --ink-400:#55637a;
    --mist-50:#f7f8fa; --mist-100:#f1f3f5; --mist-200:#e3e7ec; --mist-300:#cfd6de;
    --brass-500:#a16207; --brass-400:#ca8a04; --brass-soft:#f5c542;
    --album:#0f172a; --album-2:#060b16; --album-text:#f2f5fa; --album-muted:#94a3b8;
    --line: rgba(15,23,42,.12); --serif: Literata, Georgia, serif; --sans: "Golos Text", "Segoe UI", system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin:0; background: var(--mist-100); color: var(--ink-800); font-family: var(--sans); font-size: 15px; line-height: 1.55; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 56px 32px 96px; }
  h1 { font-family: var(--serif); font-weight: 500; font-size: 42px; line-height: 1.1; margin: 0 0 12px; letter-spacing: -.01em; }
  h2 { font-family: var(--serif); font-weight: 500; font-size: 27px; margin: 0 0 6px; }
  .lede { max-width: 62ch; color: var(--ink-500); }
  .eyebrow { margin: 0 0 4px; font-size: 11.5px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--brass-500); }
  .mock { border-radius: 18px; overflow: hidden; margin: 26px 0; border: 1px solid var(--line); }
  .mock--dark { background: var(--album); }
  .mock--light { background: #fff; }
  .mock__bar { display:flex; align-items:center; justify-content:space-between; padding: 14px 22px; }
  .mock__brand { display:flex; align-items:center; gap: 10px; }
  .mock__tile { display:grid; place-items:center; width:36px; height:36px; border-radius:10px; border:1px solid rgba(202,138,4,.5); }
  .mock--dark .mock__tile { background: rgba(255,255,255,.06); }
  .mock--light .mock__tile { background: var(--mist-50); }
  .mock__name { font-family: var(--serif); font-size: 19px; }
  .mock--dark .mock__name { color: var(--album-text); }
  .mock__nav { display:flex; gap: 18px; font-size: 13.5px; align-items:center; }
  .mock--dark .mock__nav { color: var(--album-muted); }
  .mock--light .mock__nav { color: var(--ink-400); }
  .mock__cta { padding: 8px 14px; border-radius: 10px; background: var(--brass-soft); color: var(--ink-800); font-weight: 600; }
  .card { background: #fff; border: 1px solid var(--line); border-radius: 20px; padding: 28px 30px 24px; margin: 22px 0; }
  .card__head { display:flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
  .idea { margin: 0; color: var(--ink-500); }
  .pick { font-size: 11.5px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--brass-500); border:1px solid rgba(161,98,7,.35); border-radius: 999px; padding: 5px 11px; white-space: nowrap; }
  .stage { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 22px 0 6px; }
  .stage__light, .stage__dark { border-radius: 14px; padding: 18px 20px; border: 1px solid var(--line); background: var(--mist-50); }
  .stage__dark { background: var(--album); border-color: transparent; }
  .stage__dark .stage__label, .stage__dark .stage__sub { color: var(--album-muted); }
  .stage__dark .lockup path { color: inherit; }
  .stage__label { margin: 0 0 14px; font-size: 11.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-400); }
  .stage__sub { margin: 14px 0 -6px; font-size: 11.5px; color: var(--ink-400); }
  .stage__row { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
  .stage__row--tight { margin-top: 10px; }
  .mark-lg { display: inline-flex; }
  .lockup--mock { height: 30px; width: auto; }
  .row6 { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-top: 20px; }
  .row6__item { margin: 0; text-align: center; background: var(--mist-50); border: 1px solid var(--line); border-radius: 14px; padding: 16px 12px 14px; }
  .row6__mark { display: grid; place-items: center; height: 96px; }
  .row6 figcaption { margin-top: 10px; display: grid; gap: 4px; }
  .row6 figcaption b { font-family: var(--serif); font-weight: 500; font-size: 14.5px; }
  .row6 figcaption span { font-size: 11.5px; color: var(--ink-400); line-height: 1.35; }
  .sizes { margin-top: 20px; border-top: 1px dashed var(--line); padding-top: 18px; }
  .sizes__row { display: flex; align-items: flex-end; gap: 18px; flex-wrap: wrap; }
  .size { margin: 0; text-align: center; }
  .size__box { display: grid; place-items: center; background: var(--mist-50); border: 1px solid var(--line); border-radius: 10px; }
  .size figcaption { margin-top: 6px; font-size: 11px; color: var(--ink-400); }
  .note { margin: 18px 0 0; color: var(--ink-500); border-left: 2px solid var(--mist-300); padding-left: 14px; }
  .tabs { margin: 26px 0 0; }
  .tabstrip { display:flex; gap: 10px; align-items:flex-end; background:#fff; border:1px solid var(--line); border-radius: 12px 12px 0 0; padding: 10px 14px 0; }
  .tab { display:flex; align-items:center; gap: 7px; font-size: 12.5px; color: var(--ink-700); background: var(--mist-100); border:1px solid var(--line); border-bottom:none; border-radius: 9px 9px 0 0; padding: 7px 12px 9px; }
  .tab--active { background:#fff; }
  .tabstrip__rest { flex: 1; }
  footer { margin-top: 46px; color: var(--ink-400); font-size: 13.5px; border-top: 1px solid var(--line); padding-top: 22px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: var(--mist-100); padding: 1px 5px; border-radius: 5px; }
  .words { margin: 20px 0 0; display: grid; gap: 12px; }
  .words__row { display: flex; align-items: center; gap: 22px; background: var(--mist-50); border: 1px solid var(--line); border-radius: 12px; padding: 14px 18px; }
  .words__row--dark { background: var(--album); border-color: transparent; }
  .words__row--dark .words__label { color: var(--album-muted); }
  .words__label { flex: 0 0 290px; font-size: 12px; color: var(--ink-400); }
  .rejected { list-style: none; margin: 18px 0 0; padding: 0; display: grid; gap: 10px; }
  .rejected li { display: grid; grid-template-columns: 250px 1fr; gap: 18px; padding: 12px 0; border-top: 1px solid var(--line); }
  .rejected li:first-child { border-top: none; }
  .rejected b { color: var(--ink-800); font-weight: 600; }
  .rejected span { color: var(--ink-500); }
  @media (max-width: 900px) { .row6 { grid-template-columns: repeat(2, 1fr); } .stage { grid-template-columns: 1fr; } .words__row { flex-direction: column; align-items: flex-start; } .words__label { flex: none; } .rejected li { grid-template-columns: 1fr; gap: 4px; } }
</style>
</head>
<body>
<div class="wrap">
  <p class="eyebrow">Torlmud · төрлмүд · родственники</p>
  <h1>Шесть вариантов логотипа</h1>
  <p class="lede">Знаки нарисованы на одной сетке 24×24 и одном штрихе, поэтому любой из них встаёт
  в существующую шапку без переделки вёрстки. Надпись переведена в кривые — файлы открываются
  где угодно, шрифт не нужен. Палитра — из текущего визуального языка сайта: чернила
  <code>#0f172a</code>, латунь <code>#a16207</code>.</p>

  <section class="card" id="all-marks">
    <h2>Все шесть знаков рядом</h2>
    <p class="idea">Первые три — про род и письменность, следующие два — про дом и степь, последний — про сам сервис.</p>
    <div class="row6">
      ${MARKS.map(
        (m) => `<figure class="row6__item">
        <div class="row6__mark">${iconSvg(m, { size: 88, mode: "color" })}</div>
        <figcaption><b>${esc(m.name)}</b><span>${esc(m.idea)}</span></figcaption>
      </figure>`,
      ).join("\n      ")}
    </div>
  </section>

  <div class="tabs">
    <p class="eyebrow">Как это выглядит в шапке</p>
    <p class="stage__label">Знак в плашке — как сейчас устроена шапка сайта</p>
    ${headerMock(picked, "dark")}
    <p class="stage__label">Готовый лок-ап без плашки, светлая тема</p>
    ${headerMock(picked, "light", "lockup")}
  </div>

  ${MARKS.map(conceptCard).join("\n\n  ")}

  <section class="card" id="tabtest">
    <h2>Иконка вкладки: полная спираль и компактная</h2>
    <p class="idea">На 16 px три витка сливаются, поэтому для вкладки и иконки приложения
    нарисована компактная спираль — шаг между витками шире, штрих толще. Верхний ряд — полная,
    нижний — компактная. Ниже — как это выглядит во вкладках.</p>
    <div class="sizes">
      <div class="sizes__row">
        ${[16, 24, 32, 48].map((s) => `<figure class="size"><div class="size__box" style="width:${s + 16}px;height:${s + 16}px">${iconSvg(picked, { size: s, mode: "color", weight: "bold" })}</div><figcaption>полная ${s} px</figcaption></figure>`).join("\n        ")}
      </div>
      <div class="sizes__row" style="margin-top:14px">
        ${[16, 24, 32, 48].map((s) => `<figure class="size"><div class="size__box" style="width:${s + 16}px;height:${s + 16}px">${iconSvg(SPIRAL_COMPACT, { size: s, mode: "color", weight: "bold" })}</div><figcaption>компактная ${s} px</figcaption></figure>`).join("\n        ")}
      </div>
    </div>
    <div class="tabstrip">
      <span class="tab tab--active">${iconSvg(SPIRAL_COMPACT, { size: 16, mode: "color", weight: "bold" })}<span>torlmud.ru</span></span>
      <span class="tab">${iconSvg(MARKS[1], { size: 16, mode: "color", weight: "bold" })}<span>torlmud.ru</span></span>
      <span class="tab">${iconSvg(MARKS[2], { size: 16, mode: "color", weight: "bold" })}<span>torlmud.ru</span></span>
      <span class="tab">${iconSvg(MARKS[3], { size: 16, mode: "color", weight: "bold" })}<span>torlmud.ru</span></span>
      <span class="tab">${iconSvg(MARKS[4], { size: 16, mode: "color", weight: "bold" })}<span>torlmud.ru</span></span>
      <span class="tab">${iconSvg(MARKS[5], { size: 16, mode: "color", weight: "bold" })}<span>torlmud.ru</span></span>
      <span class="tabstrip__rest"></span>
    </div>
  </section>

  <section class="card" id="wordmark">
    <h2>Надпись</h2>
    <p class="idea">Основной вариант — <b>Torlmud</b> в Literata: так же, как домен <code>torlmud.ru</code>,
    как в коде сайта и в его заголовках. Строчная надпись оставлена запасной: она ближе к адресу,
    но хуже читается как имя.</p>
    <div class="words">
      <div class="words__row"><span class="words__label">Literata, Torlmud — основной</span>${lockupSvg(picked, { tone: "light" })}</div>
      <div class="words__row"><span class="words__label">Literata, строчная — запасной</span>${lockupSvg(picked, { word: "lower", tone: "light" })}</div>
      <div class="words__row"><span class="words__label">Golos Text, Torlmud</span>${lockupSvg(picked, { font: "golos", tone: "light" })}</div>
      <div class="words__row words__row--dark"><span class="words__label">Literata, на тёмной обложке</span>${lockupSvg(picked, { tone: "dark" })}</div>
      <div class="words__row"><span class="words__label">Вертикальный штамп с подписью — подвал и OG-картинка</span>${stackedSvg(picked)}</div>
    </div>
    <p class="note">Написание согласовано: бренд — <b>Torlmud</b>, домен — <code>torlmud.ru</code>,
    так же в <code>&lt;title&gt;</code> и в текстах сайта. Калмыцкое слово, от которого имя пошло, —
    <b>төрлмүд</b> («родня»); оно стоит подписью в вертикальном штампе, а не в основной надписи.</p>
  </section>

  <section class="card" id="not-taken">
    <h2>Что сознательно не взяли</h2>
    <p class="idea">Калмыцкая тема легко уводит в госсимволику и в сакральные образы. Отклонённые мотивы и причины:</p>
    <ul class="rejected">
      ${REJECTED.map(([t, r]) => `<li><b>${esc(t)}</b><span>${esc(r)}</span></li>`).join("\n      ")}
    </ul>
  </section>

  <footer>
    Файлы: <code>svg/&lt;знак&gt;.svg</code> — одноцветный знак цветом текста,
    <code>svg/&lt;знак&gt;-bold.svg</code> — утолщённый для 16–24 px,
    <code>svg/&lt;знак&gt;-color.svg</code> — в палитре сайта,
    <code>svg/lockup/…</code> — знак с надписью (Literata, Golos Text, тёмный вариант).
    Выбранный знак — «${esc(picked.name)}».
  </footer>
</div>
<script>
  // Координаты блоков для нарезки картинок (tools/shots.sh + tools/crop.mjs)
  window.addEventListener("load", () => {
    const rects = {};
    document.querySelectorAll("section[id], .tabs").forEach((el) => {
      const r = el.getBoundingClientRect();
      const id = el.id || "tabs";
      rects[id] = { x: Math.round(r.x + window.scrollX), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) };
    });
    const pre = document.createElement("pre");
    pre.id = "metrics";
    pre.style.display = "none";
    pre.textContent = JSON.stringify({ pageHeight: document.body.scrollHeight, rects });
    document.body.appendChild(pre);
  });
</script>
</body>
</html>
`;

write(ROOT, "index.html", html);

console.log("готово:", written.length + 1, "файлов");
for (const f of written) console.log("  ", f);
