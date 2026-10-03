#!/usr/bin/env bash
# Снимки тестовых страниц интерфейса (headless Chrome).
#
# Зачем: варианты — это макеты, и проверять их глазами удобнее по картинкам.
# Скрипт сохраняет каждую страницу целиком в натуральную величину и вырезает
# из неё превью первого макета для обзорной страницы. Результат — ui-variants/shots/.
#
# Особенности, на которые я уже наступал:
#   1. Chrome в headless-режиме отрисовывает страницу, но не выходит сам
#      (падает на завершении) и пишет файл раньше, чем страница докрасится.
#      Поэтому ждём, пока размер файла перестанет меняться, и только потом гасим.
#   2. Якорь (#mobile) браузер отрабатывает до того, как встанет вёрстка, и
#      уезжает в пустой хвост страницы. Поэтому снимаем страницу целиком
#      высоким окном, а не по секциям.
#
# Запуск:  bash ui-variants/render-shots.sh

set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# Профиль вне репозитория и уникальный для запуска: два Chrome с одним профилем
# дерутся за каталог, и снимок молча не пишется.
PROFILE="$(mktemp -d "${TMPDIR:-/tmp}/torlmood-shots-profile.XXXXXX")"
OUT="$ROOT/shots"
TALL=6000
VARIANTS="a-quiet-archive b-canvas-studio b-canvas-studio-light c-family-atlas d-card-catalog e-chronicle"

if [ ! -x "$CHROME" ]; then
  echo "Не найден Google Chrome: $CHROME" >&2
  exit 1
fi

cleanup() { rm -rf "$PROFILE"; }
trap cleanup EXIT

mkdir -p "$OUT" "$PROFILE"

shot() { # файл, имя, ширина, высота
  local file="$1" name="$2" w="${3:-1440}" h="${4:-$TALL}"
  local out="$OUT/$name.png"
  rm -f "$out"

  "$CHROME" --headless=new --no-sandbox --disable-gpu --disable-gpu-sandbox \
    --in-process-gpu --disable-software-rasterizer --no-first-run \
    --disable-crash-reporter --disable-breakpad --hide-scrollbars \
    --force-device-scale-factor=1 --user-data-dir="$PROFILE" \
    --virtual-time-budget=8000 \
    --window-size="$w,$h" --screenshot="$out" \
    "file://$ROOT/$file" >/dev/null 2>&1 &

  local pid=$! prev=-1 size=0 stable=0
  for _ in $(seq 1 200); do
    size=$(stat -f%z "$out" 2>/dev/null || echo 0)
    if [ "$size" -gt 0 ] && [ "$size" = "$prev" ]; then
      stable=$((stable + 1))
      [ "$stable" -ge 3 ] && break
    else
      stable=0
    fi
    prev="$size"
    sleep 0.25
  done
  sleep 0.5
  kill "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null

  if [ -s "$out" ]; then echo "ok   $name.png ($(stat -f%z "$out") байт)"; else echo "FAIL $name.png"; fi
}

for v in $VARIANTS; do
  [ -f "$ROOT/$v.html" ] || { echo "нет $v.html — пропускаю"; continue; }
  shot "$v.html" "$v-full"
done
[ -f "$ROOT/index.html" ] && shot "index.html" "index" 1440 2600

# ---- Превью макетов: вырезаем браузерную рамку из полной страницы ----
# Ищем верхнюю границу рамки: длинный ряд пикселей цвета --mist-300 (#c6cfdd).
PY=""
for candidate in python3 "$HOME/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3"; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c "import PIL" >/dev/null 2>&1; then
    PY="$candidate"; break
  fi
done

if [ -z "$PY" ]; then
  echo "Превью пропущены: нужен python3 с Pillow (PIL)"
  exit 0
fi

"$PY" - "$OUT" "$VARIANTS" <<'PY'
import sys, pathlib
from PIL import Image

out = pathlib.Path(sys.argv[1])
NAMES = sys.argv[2].split()
TARGET = (198, 207, 221)   # --mist-300
TOL = 16

def close(px, target, tol=TOL):
    return all(abs(px[i] - target[i]) <= tol for i in range(3))

for name in NAMES:
    src = out / f"{name}-full.png"
    if not src.exists():
        print(f"нет {src.name}")
        continue

    img = Image.open(src).convert("RGB")
    w, h = img.size
    px = img.load()

    # Верхняя граница рамки — длинный горизонтальный прогон цвета --mist-300.
    # Ищем лучший прогон в каждой строке: короткие обрывы (точки фона, скругления
    # углов, конец строки) не должны сбивать поиск.
    top = center = None
    for y in range(min(h, 1600)):
        best = (0, None, None)
        start = None
        for x in range(w + 1):
            match = x < w and close(px[x, y], TARGET)
            if match:
                if start is None:
                    start = x
            elif start is not None:
                if x - start > best[0]:
                    best = (x - start, start, x - 1)
                start = None
        if best[0] >= 1200:                     # рамка шириной 1280
            top = y
            center = (best[1] + best[2]) // 2
            break

    if top is None:
        print(f"{name}: рамка не найдена")
        continue

    # Обрезаем по центру рамки: 1284 по ширине (1280 + рамка по краям)
    # и 863 по высоте (1 рамка + 40 адресная строка + 820 экран + запас).
    box = (max(center - 642, 0), max(top - 1, 0),
           min(center + 642, w), min(top + 862, h))
    shot = img.crop(box)
    shot.thumbnail((760, 10_000), Image.LANCZOS)
    dst = out / f"{name}-thumb.png"
    shot.save(dst)
    print(f"ok   {dst.name} ({shot.width}x{shot.height})")
PY

echo "Готово. Картинки: $OUT"
