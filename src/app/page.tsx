"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useUi } from "@/lib/ui-store";
import { isPro } from "@/lib/limits";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function Home() {
  const mounted = useMounted();
  const tab = useUi((s) => s.tab);
  const openAdd = useUi((s) => s.openAdd);
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
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-base font-bold text-white">
              ₽
            </div>
            <div>
              <div className="text-base font-bold leading-none">Гонорар</div>
              <div className="text-[11px] leading-tight text-muted-foreground">
                учёт доходов фрилансера
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!pro && (
              <Badge
                variant="outline"
                className="cursor-pointer border-amber-400 text-amber-600 dark:text-amber-400"
                onClick={() => useUi.getState().openPro()}
              >
                Pro
              </Badge>
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full"
              aria-label="Поиск по операциям и клиентам"
              onClick={openSearch}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-4">
        {tab === "ledger" && <LedgerView />}
        {tab === "clients" && <ClientsView />}
        {tab === "analytics" && <AnalyticsView />}
        {tab === "settings" && <SettingsView />}
      </main>

      {/* Кнопка быстрого ввода */}
      <Button
        onClick={() => openAdd()}
        aria-label="Добавить операцию"
        size="lg"
        className="fixed bottom-[76px] right-4 z-40 h-14 w-14 rounded-full bg-emerald-600 p-0 shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 sm:right-[max(1rem,calc(50vw-22rem))]"
      >
        <Plus className="h-7 w-7" />
      </Button>

      <BottomNav />
      <AddOperationSheet />
      <ProDialog />
      <GlobalSearch />
      <WelcomeDialog />
      <ServiceWorkerRegister />
    </div>
  );
}
