// Типы данных приложения «Гонорар» — учёт доходов фрилансера

export type OpKind = "income" | "expense";

/** Часть оплаты: разовая, предоплата или остаток по сделке */
export type PayPart = "single" | "prepay" | "rest";

export interface Client {
  id: string;
  name: string;
  contact?: string;
  note?: string;
  createdAt: string; // ISO datetime
}

export interface Operation {
  id: string;
  date: string; // 'YYYY-MM-DD'
  amount: number; // всегда положительное число
  kind: OpKind;
  type?: string; // категория: «Таплинк», «Консультация», «Таргет»…
  source?: string; // источник клиента: «Инста», «Рекомендация», «Таргет»…
  clientId?: string;
  clientName?: string; // снимок имени (если клиент не заведён)
  note?: string;
  part: PayPart;
  dealId?: string; // связывает предоплату и остаток
  dealTotal?: number; // полная сумма сделки
  createdAt: string;
  updatedAt: string;
}

export interface Categories {
  incomeTypes: string[];
  expenseTypes: string[];
  sources: string[];
}

export interface Settings {
  monthlyGoal: number; // цель по доходу в месяц, ₽
}

export interface License {
  name: string; // на чьё имя активирован ключ
  key: string;
  activatedAt: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface SyncSnapshot {
  version: 1;
  operations: Operation[];
  clients: Client[];
  categories: Categories;
  settings: Settings;
  exportedAt: string;
}
