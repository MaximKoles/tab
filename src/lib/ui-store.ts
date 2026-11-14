"use client";

import { create } from "zustand";
import type { PayPart } from "./types";

export type TabKey = "ledger" | "clients" | "analytics" | "settings";

export interface AddPrefill {
  kind?: "income" | "expense";
  clientId?: string;
  dealId?: string;
  part?: PayPart;
  /** Повтор прошлой операции: сумма, услуга, источник */
  amount?: number;
  type?: string;
  source?: string;
}

interface AddSheetState {
  open: boolean;
  editId: string | null;
  prefill: AddPrefill;
}

interface UiState {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  proOpen: boolean;
  openPro: () => void;
  closePro: () => void;
  /** Глобальный поиск по операциям и клиентам */
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  /** Открытая карточка клиента (из поиска и со вкладки «Клиенты») */
  clientDetailId: string | null;
  openClient: (id: string) => void;
  closeClient: () => void;
  /** Куда перейти на вкладке «Учёт» после импорта (месяц последних данных) */
  ledgerNav: { y: number; m: number } | null;
  navigateLedger: (y: number, m: number) => void;
  clearLedgerNav: () => void;
  addSheet: AddSheetState;
  openAdd: (prefill?: AddPrefill) => void;
  openEdit: (opId: string) => void;
  closeAdd: () => void;
}

export const useUi = create<UiState>((set) => ({
  tab: "ledger",
  setTab: (tab) => set({ tab }),
  proOpen: false,
  openPro: () => set({ proOpen: true }),
  closePro: () => set({ proOpen: false }),
  searchOpen: false,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  clientDetailId: null,
  openClient: (clientDetailId) => set({ clientDetailId }),
  closeClient: () => set({ clientDetailId: null }),
  ledgerNav: null,
  navigateLedger: (y, m) => set({ ledgerNav: { y, m } }),
  clearLedgerNav: () => set({ ledgerNav: null }),
  addSheet: { open: false, editId: null, prefill: {} },
  openAdd: (prefill = {}) => set({ addSheet: { open: true, editId: null, prefill } }),
  openEdit: (opId) => set({ addSheet: { open: true, editId: opId, prefill: {} } }),
  closeAdd: () => set({ addSheet: { open: false, editId: null, prefill: {} } }),
}));
