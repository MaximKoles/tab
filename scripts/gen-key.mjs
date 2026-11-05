#!/usr/bin/env node
// Генератор лицензионных ключей Pro для «Гонорара».
// Запуск:  node scripts/gen-key.mjs "Имя Покупателя"
// Ключ вводится покупателем в приложении: Ещё → Гонорар Pro → Имя + Ключ.
//
// ВАЖНО: SECRET должен совпадать с SECRET в src/lib/license.ts.
// Смена секрета = все старые ключи перестают работать (и это способ их отзывать).

import { createHmac } from "node:crypto";

const SECRET = "GONORAR-PRO-2026-v1";

const name = process.argv[2];
if (!name) {
  console.error('Использование: node scripts/gen-key.mjs "Имя Покупателя"');
  process.exit(1);
}

const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
const digest = createHmac("sha256", SECRET).update(normalized).digest("hex").slice(0, 12).toUpperCase();
const key = digest.match(/.{1,4}/g).join("-");

console.log(`Имя:  ${name.trim()}`);
console.log(`Ключ: ${key}`);
