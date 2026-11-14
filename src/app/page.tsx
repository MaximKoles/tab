"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Plus, Search } from "lucide-react";
import { BottomNav } from "@/components/app/bottom-nav";
import { AddOperationSheet } from "@/components/app/add-operation-sheet";
import { ProDialog } from "@/components/app/pro-dialog";
import { GlobalSearch } from "@/components/app/global-search";
import { WelcomeDialog } from "@/components/app/welcome-dialog";
import { LedgerView } from "@/components/app/ledger-view";
import { ClientsView } from "@/components/app/clients-view";
import { AnalyticsView } from "@/components/app/analytics-view";
import { SettingsView } from "@/components/app/settings-view";
import { useStore } from "@/lib/store";
import { useUi, type TabKey } from "@/lib/ui-store";
import { isPro } from "@/lib/limits";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h.includes("preview") || h.includes("space-z")) {
      return; // в песочнице и при разработке SW не нужен
    }
    const swUrl = new URL("sw.js", document.baseURI).toString();
    navigator.serviceWorker.register(swUrl).catch(() => {});
  }, []);
  return null;
}

// Флаг гидратации без setState в effect (SSR-скелет → приложение)
const emptySubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

const tgApi = () => {
  const tg = (window as unknown as { Telegram?: { WebApp?: { ready: () => void; expand: () => void } } })
    .Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }
};

const TITLES: Record<TabKey, string> = {
  ledger: "Учёт",
  clients: "Клиенты",
  analytics: "Аналитика",
  settings: "Ещё",
};

/* Круглая пилюля-кнопка в шапке */
function PillButton({
  onClick,
  label,
  dark,
  children,
}: {
  onClick: () => void;
  label: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
        dark
          ? "bg-primary text-primary-foreground hover:bg-primary/85"
          : "border border-border bg-card text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

export default function Home() {
  const mounted = useMounted();
  const tab = useUi((s) => s.tab);
  const openAdd = useUi((s) => s.openAdd);
  const openClientForm = useUi((s) => s.openClientForm);
  const openSearch = useUi((s) => s.openSearch);
  const license = useStore((s) => s.license);
  const pro = isPro(license);

  useEffect(() => {
    tgApi();
  }, []);

  // Ctrl/Cmd+K открывает глобальный поиск
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useUi.getState().openSearch();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!mounted) {
    return (
      <main className="mx-auto w-full max-w-md space-y-4 px-5 pt-10">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-36">
        {/* Шапка экрана: крупный заголовок + пилюли действий */}
        <div className="flex items-center justify-between gap-3 pb-5 pt-9">
          <h1 className="text-[32px] font-bold leading-none tracking-tight">{TITLES[tab]}</h1>
          <div className="flex items-center gap-2">
            {!pro && (
              <button
                onClick={() => useUi.getState().openPro()}
                className="flex h-11 shrink-0 items-center rounded-full bg-lemon px-3.5 text-sm font-bold text-foreground transition-colors hover:brightness-95"
                aria-label="Про версию"
              >
                Pro
              </button>
            )}
            <PillButton onClick={openSearch} label="Поиск по операциям и клиентам">
              <Search className="h-[18px] w-[18px]" />
            </PillButton>
            {(tab === "ledger" || tab === "clients") && (
              <PillButton
                dark
                onClick={tab === "ledger" ? () => openAdd() : openClientForm}
                label={tab === "ledger" ? "Добавить операцию" : "Новый клиент"}
              >
                <Plus className="h-5 w-5" />
              </PillButton>
            )}
          </div>
        </div>

        {tab === "ledger" && <LedgerView />}
        {tab === "clients" && <ClientsView />}
        {tab === "analytics" && <AnalyticsView />}
        {tab === "settings" && <SettingsView />}
      </main>

      <BottomNav />
      <AddOperationSheet />
      <ProDialog />
      <GlobalSearch />
      <WelcomeDialog />
      <ServiceWorkerRegister />
    </div>
  );
}
