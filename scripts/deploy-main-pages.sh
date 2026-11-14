#!/usr/bin/env bash
# Деплой статики в корень ветки main.
# Источник GitHub Pages: branch=main, path=/ — файлы корня отдаются по URL
# https://maximkoles.github.io/tab/<файл>, поэтому сборка делается с
# NEXT_PUBLIC_BASE_PATH=/tab и копируется в корень репозитория.
# .nojekyll обязателен, иначе Jekyll отбрасывает каталог _next/.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build:pages

# старые артефакты прошлых деплоев
rm -rf _next _not-found
rm -f index.html 404.html index.txt _not-found.html _not-found.txt \
      robots.txt sw.js manifest.webmanifest apple-touch-icon.png \
      icon-192.png icon-512.png logo.svg .nojekyll \
      __next.__PAGE__.txt __next._full.txt __next._head.txt \
      __next._index.txt __next._tree.txt

cp -r out/. .
touch .nojekyll

git add -A
git commit -m "Деплой статики в корень main: $(date -u +%Y-%m-%d_%H:%M)"
git push origin main
echo "Pushed. Pages пересоберётся автоматически за ~1 минуту."
