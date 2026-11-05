"use client";

import { BarChart3, NotebookPen, Settings, Users } from "lucide-react";
import { useUi, type TabKey } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

const TABS: Array<{
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "ledger", label: "Учёт", icon: NotebookPen },
  { key: "clients", label: "Клиенты", icon: Users },
  { key: "analytics", label: "Аналитика", icon: BarChart3 },
  { key: "settings", label: "Ещё", icon: Settings },
];

export function BottomNav() {
  const { tab, setTab } = useUi();
  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex max-w-3xl">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              tab === key
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
