"use client";

import { create } from "zustand";
import type { PayPart } from "./types";

export type TabKey = "ledger" | "clients" | "analytics" | "settings";

export interface AddPrefill {
  kind?: "income" | "expense";
  clientId?: string;
  dealId?: string;
  part?: PayPart;
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
  addSheet: { open: false, editId: null, prefill: {} },
  openAdd: (prefill = {}) => set({ addSheet: { open: true, editId: null, prefill } }),
  openEdit: (opId) => set({ addSheet: { open: true, editId: opId, prefill: {} } }),
  closeAdd: () => set({ addSheet: { open: false, editId: null, prefill: {} } }),
}));
