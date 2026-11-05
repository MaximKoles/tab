// Генерация иконок PWA из SVG (sharp уже установлен в проекте)
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="#059669"/>
  <path d="M256 88 L388 224 L300 224 L300 336 L212 336 L212 224 L124 224 Z" fill="#ffffff"/>
  <rect x="124" y="392" width="264" height="36" rx="18" fill="#ffffff" opacity="0.9"/>
</svg>`;

mkdirSync("public", { recursive: true });

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(`public/icon-${size}.png`);
  console.log(`public/icon-${size}.png — готово`);
}

await sharp(Buffer.from(svg)).resize(180, 180).png().toFile("public/apple-touch-icon.png");
console.log("public/apple-touch-icon.png — готово");
