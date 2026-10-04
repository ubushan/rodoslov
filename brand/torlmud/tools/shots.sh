#!/usr/bin/env bash
# Снимки страницы превью логотипа (headless Chrome).
#
# Особенность среды: Chrome в headless-режиме рисует страницу и пишет файл,
# но сам не выходит — процесс висит бесконечно. Поэтому оба прохода идут
# в фоне, а скрипт ждёт, пока файл перестанет расти, и потом гасит Chrome.
#
# Проходы:
#   1. --dump-dom: страница сама считает высоту и координаты блоков и кладёт их
#      в скрытый <pre id="metrics">. Окно обязательно то же, что при съёмке,
#      иначе медиазапросы дадут другую раскладку и координаты разъедутся.
#   2. --screenshot: окно высотой во всю страницу (Chrome не умеет «весь
#      документ», поэтому высоту берём из метрик).
#
# Запуск: bash brand/torlmud/tools/shots.sh [ширина]
set -eu

ROOT="/Users/ubushan/Documents/AI/rodoslov"
DIR="$ROOT/brand/torlmud"
OUT="$DIR/png"
W="${1:-1400}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL="file://$DIR/index.html"
PROFILE="$(mktemp -d "${TMPDIR:-/tmp}/torlmud-logo.XXXXXX")"
trap 'rm -rf "$PROFILE"' EXIT

[ -x "$CHROME" ] || { echo "нет Chrome: $CHROME" >&2; exit 1; }
mkdir -p "$OUT"

common=(--headless=new --no-sandbox --disable-gpu --disable-gpu-sandbox --in-process-gpu
        --disable-software-rasterizer --no-first-run --disable-crash-reporter --disable-breakpad
        --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROFILE"
        --virtual-time-budget=5000)

# Ждёт, пока файл появится и три проверки подряд не будет менять размер.
wait_file() { # файл, максимум секунд
  local file="$1" limit="${2:-90}" prev=-1 size=0 stable=0
  for _ in $(seq 1 $((limit * 2))); do
    size=$(stat -f%z "$file" 2>/dev/null || echo 0)
    if [ "$size" -gt 0 ] && [ "$size" = "$prev" ]; then
      stable=$((stable + 1)); [ "$stable" -ge 3 ] && return 0
    else stable=0; fi
    prev=$size; sleep 0.5
  done
  return 1
}

echo "— проход 1: метрики (окно ${W}px)"
rm -f "$OUT/dom.html"
"$CHROME" "${common[@]}" --window-size="$W,1000" --dump-dom "$URL" > "$OUT/dom.html" 2>/dev/null &
pid=$!
wait_file "$OUT/dom.html" 90 || true
kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true

HEIGHT=$(node -e '
  const fs = require("fs");
  const html = fs.readFileSync(process.argv[1], "utf8");
  const m = html.match(/<pre id="metrics"[^>]*>([\s\S]*?)<\/pre>/);
  if (!m) { console.error("метрики не найдены в DOM"); process.exit(1); }
  const j = JSON.parse(m[1].replace(/&quot;/g, "\"").replace(/&amp;/g, "&"));
  fs.writeFileSync(process.argv[2], JSON.stringify(j));
  console.log(j.pageHeight);
' "$OUT/dom.html" "$OUT/metrics.json")
echo "  высота страницы: ${HEIGHT}px"
[ -n "$HEIGHT" ] || { echo "пустая высота — прерываю" >&2; exit 1; }

echo "— проход 2: снимок"
rm -f "$OUT/preview-full.png"
"$CHROME" "${common[@]}" --force-device-scale-factor=2 \
  --window-size="$W,$((HEIGHT + 40))" --screenshot="$OUT/preview-full.png" "$URL" >/dev/null 2>&1 &
pid=$!
wait_file "$OUT/preview-full.png" 120 || { echo "снимок не появился" >&2; kill "$pid" 2>/dev/null || true; exit 1; }
kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true
echo "  снимок: $(stat -f%z "$OUT/preview-full.png") байт"

echo "— проход 3: нарезка"
node "$DIR/tools/crop.mjs"
