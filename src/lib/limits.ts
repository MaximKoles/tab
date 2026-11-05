import type { License } from "./types";

// Лимиты бесплатной версии (Free) — единая точка настройки тарифа
export const FREE_LIMITS = {
  operations: 30,
  clients: 10,
};

// Цены для карточки Pro (₽). Ранняя цена — для покупателей таблицы.
export const PRICE = {
  pro: 990,
  earlyBird: 490,
};

export function isPro(license: License | null | undefined): boolean {
  return !!license && !!license.key;
}

export function proFeatureHint(feature: string): string {
  return `«${feature}» доступно в Pro-версии`;
}
