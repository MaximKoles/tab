import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Categories,
  Client,
  License,
  Operation,
  Settings,
  SupabaseConfig,
  SyncSnapshot,
} from "./types";
import { demoOperations, demoClients } from "./demo";

export const DEFAULT_CATEGORIES: Categories = {
  incomeTypes: ["Таплинк", "Консультация", "Партнёрка", "Дизайн баннера"],
  expenseTypes: ["Таргет", "Комиссии", "Обслуживание", "Прочее"],
  sources: ["Рекомендация", "Инста", "Таргет", "Яндекс", "Авито"],
};

const DEFAULT_SETTINGS: Settings = { monthlyGoal: 0 };

interface AppState {
  operations: Operation[];
  clients: Client[];
  categories: Categories;
  settings: Settings;
  license: License | null;
  supabase: SupabaseConfig;

  addOperation: (op: Omit<Operation, "id" | "createdAt" | "updatedAt">) => Operation;
  updateOperation: (id: string, patch: Partial<Operation>) => void;
  deleteOperation: (id: string) => void;

  addClient: (c: Omit<Client, "id" | "createdAt">) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  renameType: (oldV: string, newV: string) => void;
  addIncomeType: (v: string) => void;
  removeIncomeType: (v: string) => void;
  addExpenseType: (v: string) => void;
  removeExpenseType: (v: string) => void;
  addSource: (v: string) => void;
  removeSource: (v: string) => void;

  setSettings: (patch: Partial<Settings>) => void;
  setLicense: (l: License) => void;
  clearLicense: () => void;
  setSupabaseConfig: (patch: Partial<SupabaseConfig>) => void;

  importSnapshot: (snap: SyncSnapshot) => void;
  /** Импорт из CSV: перепривязывает клиентов по имени и добавляет их категории */
  applyImport: (ops: Operation[], clients: Client[]) => { ops: number; clients: number };
  loadDemo: () => void;
  clearAll: () => void;
}

function nowISO() {
  return new Date().toISOString();
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      operations: [],
      clients: [],
      categories: DEFAULT_CATEGORIES,
      settings: DEFAULT_SETTINGS,
      license: null,
      supabase: { url: "", anonKey: "" },

      addOperation: (draft) => {
        const op: Operation = {
          ...draft,
          id: crypto.randomUUID(),
          createdAt: nowISO(),
          updatedAt: nowISO(),
        };
        set((s) => ({ operations: [op, ...s.operations] }));
        return op;
      },

      updateOperation: (id, patch) =>
        set((s) => ({
          operations: s.operations.map((o) =>
            o.id === id ? { ...o, ...patch, updatedAt: nowISO() } : o
          ),
        })),

      deleteOperation: (id) =>
        set((s) => ({ operations: s.operations.filter((o) => o.id !== id) })),

      addClient: (c) => {
        const client: Client = { ...c, id: crypto.randomUUID(), createdAt: nowISO() };
        set((s) => ({ clients: [client, ...s.clients] }));
        return client;
      },

      updateClient: (id, patch) =>
        set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

      deleteClient: (id) =>
        set((s) => ({
          clients: s.clients.filter((c) => c.id !== id),
          operations: s.operations.map((o) =>
            o.clientId === id
              ? { ...o, clientId: undefined, clientName: o.clientName ?? "Без имени" }
              : o
          ),
        })),

      renameType: (oldV, newV) =>
        set((s) => ({
          operations: s.operations.map((o) => (o.type === oldV ? { ...o, type: newV } : o)),
        })),

      addIncomeType: (v) =>
        set((s) =>
          s.categories.incomeTypes.includes(v)
            ? s
            : { categories: { ...s.categories, incomeTypes: [...s.categories.incomeTypes, v] } }
        ),
      removeIncomeType: (v) =>
        set((s) => ({
          categories: {
            ...s.categories,
            incomeTypes: s.categories.incomeTypes.filter((t) => t !== v),
          },
        })),
      addExpenseType: (v) =>
        set((s) =>
          s.categories.expenseTypes.includes(v)
            ? s
            : { categories: { ...s.categories, expenseTypes: [...s.categories.expenseTypes, v] } }
        ),
      removeExpenseType: (v) =>
        set((s) => ({
          categories: {
            ...s.categories,
            expenseTypes: s.categories.expenseTypes.filter((t) => t !== v),
          },
        })),
      addSource: (v) =>
        set((s) =>
          s.categories.sources.includes(v)
            ? s
            : { categories: { ...s.categories, sources: [...s.categories.sources, v] } }
        ),
      removeSource: (v) =>
        set((s) => ({
          categories: { ...s.categories, sources: s.categories.sources.filter((t) => t !== v) },
        })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setLicense: (l) => set({ license: l }),
      clearLicense: () => set({ license: null }),
      setSupabaseConfig: (patch) => set((s) => ({ supabase: { ...s.supabase, ...patch } })),

      importSnapshot: (snap) =>
        set({
          operations: snap.operations ?? [],
          clients: snap.clients ?? [],
          categories: snap.categories ?? DEFAULT_CATEGORIES,
          settings: snap.settings ?? DEFAULT_SETTINGS,
        }),

      applyImport: (ops, clients) => {
        const state = get();
        // Клиенты из файла: совпавшие по имени переиспользуют существующую запись,
        // новые добавляются как есть; операции перепривязываются на итоговые id
        const byName = new Map(state.clients.map((c) => [c.name.toLowerCase(), c.id] as const));
        const idMap = new Map<string, string>();
        const addedClients: Client[] = [];
        for (const c of clients) {
          const key = c.name.toLowerCase();
          const existingId = byName.get(key);
          if (existingId) {
            idMap.set(c.id, existingId);
          } else {
            byName.set(key, c.id);
            idMap.set(c.id, c.id);
            addedClients.push(c);
          }
        }
        const remapped = ops.map((o) =>
          o.clientId ? { ...o, clientId: idMap.get(o.clientId) ?? undefined } : o
        );
        // Категории из таблицы появляются в приложении — «ваша таблица, но живая»
        const incomeTypes = new Set(state.categories.incomeTypes);
        const expenseTypes = new Set(state.categories.expenseTypes);
        const sources = new Set(state.categories.sources);
        for (const o of remapped) {
          if (o.kind === "income") {
            if (o.type) incomeTypes.add(o.type);
            if (o.source) sources.add(o.source);
          } else if (o.type) {
            expenseTypes.add(o.type);
          }
        }
        set({
          clients: [...addedClients, ...state.clients],
          operations: [...remapped, ...state.operations],
          categories: {
            incomeTypes: Array.from(incomeTypes),
            expenseTypes: Array.from(expenseTypes),
            sources: Array.from(sources),
          },
        });
        return { ops: remapped.length, clients: addedClients.length };
      },

      loadDemo: () =>
        set({ operations: demoOperations(), clients: demoClients() }),

      clearAll: () => set({ operations: [], clients: [] }),
    }),
    { name: "gonorar-v1" }
  )
);

/** Текущее состояние (снимок) для экспорта и синхронизации */
export function buildSnapshot(): SyncSnapshot {
  const s = useStore.getState();
  return {
    version: 1,
    operations: s.operations,
    clients: s.clients,
    categories: s.categories,
    settings: s.settings,
    exportedAt: nowISO(),
  };
}
