#!/usr/bin/env python3
"""Разбор полного снимка страницы варианта на отдельные макеты.

Зачем: макеты проверяются глазами, а полный снимок страницы — 1440×6000,
в превью он нечитаем. Скрипт находит в нём браузерные рамки и телефоны и режет
их в натуральную величину.

Использование:
    bash ui-variants/render-shots.sh                 # сначала снимки
    python3 ui-variants/crop-mockups.py a-quiet-archive [ещё имена]

На выходе в ui-variants/shots/:
    <имя>-frame1.png, -frame2.png, …   десктопные макеты по порядку сверху вниз
    <имя>-phones.png                   ряд телефонов целиком

Нужен Pillow. Если в системном python3 его нет, подойдёт интерпретатор DSH:
/Users/ubushan/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3
"""

import pathlib
import sys

try:
    from PIL import Image
except ImportError:  # подсказка вместо стектрейса
    sys.exit(
        "Нужен Pillow. Попробуйте:\n"
        "  /Users/ubushan/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3 "
        "ui-variants/crop-mockups.py <имя варианта>"
    )

SHOTS = pathlib.Path(__file__).resolve().parent / "shots"
BORDER = (198, 207, 221)   # --mist-300: рамка браузерного макета
TOL = 16
FRAME_STEP = 870           # высота макета 862 + запас, чтобы не поймать нижнюю границу
PHONE_DARK = 340           # сумма RGB корпуса телефона


def close(px, target, tol=TOL):
    return all(abs(px[i] - target[i]) <= tol for i in range(3))


def longest_run(px, y, w, test):
    """Самый длинный прогон подряд идущих пикселей, подходящих под test."""
    best, start = (0, None, None), None
    for x in range(w + 1):
        match = x < w and test(px[x, y])
        if match:
            if start is None:
                start = x
        elif start is not None:
            if x - start > best[0]:
                best = (x - start, start, x - 1)
            start = None
    return best


def frames(px, w, h):
    """Все браузерные рамки: список (верх, центр по горизонтали)."""
    found, y = [], 0
    while y < h:
        best = longest_run(px, y, w, lambda c: close(c, BORDER))
        if best[0] >= 1200:                     # рамка шириной 1280
            found.append((y, (best[1] + best[2]) // 2))
            y += FRAME_STEP
        else:
            y += 1
    return found


def phones(px, w, h, after):
    """Первая строка с телефонами ниже отметки after; границы — по всем телефонам ряда."""
    for y in range(after, h):
        runs, start = [], None
        for x in range(w + 1):
            dark = x < w and sum(px[x, y]) < PHONE_DARK
            if dark:
                if start is None:
                    start = x
            elif start is not None:
                if x - start >= 100:
                    runs.append((start, x - 1))
                start = None
        if runs and sum(r[1] - r[0] + 1 for r in runs) >= 340:
            return y, min(r[0] for r in runs), max(r[1] for r in runs)
    return None


def main():
    names = sys.argv[1:]
    if not names:
        sys.exit(__doc__)

    for name in names:
        src = SHOTS / f"{name}-full.png"
        if not src.exists():
            print(f"нет {src.name} — сначала bash ui-variants/render-shots.sh")
            continue

        img = Image.open(src).convert("RGB")
        w, h = img.size
        px = img.load()

        bottom = 0
        for i, (top, center) in enumerate(frames(px, w, h), start=1):
            box = (max(center - 644, 0), max(top - 2, 0),
                   min(center + 644, w), min(top + 864, h))
            dst = SHOTS / f"{name}-frame{i}.png"
            img.crop(box).save(dst)
            print(f"ok {dst.name} (верх {top})")
            bottom = box[3]

        got = phones(px, w, h, bottom)
        if got:
            top, left, right = got
            box = (max(left - 6, 0), max(top - 6, 0),
                   min(right + 6, w), min(top + 880, h))
            dst = SHOTS / f"{name}-phones.png"
            img.crop(box).save(dst)
            print(f"ok {dst.name} (верх {top})")
        else:
            print(f"{name}: телефоны не найдены")


if __name__ == "__main__":
    main()
