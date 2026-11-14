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

/* Плавающая пилюля навигации: активный таб — чёрная капсула с подписью */
export function BottomNav() {
  const { tab, setTab } = useUi();
  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]"
    >
      <div className="mx-auto flex max-w-[380px] items-center justify-between gap-1 rounded-full border border-foreground/5 bg-card p-1.5 shadow-soft">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={label}
              className={cn(
                "flex h-12 min-w-12 items-center justify-center rounded-full transition-all",
                active
                  ? "flex-[1.6] gap-1.5 bg-primary px-3 text-primary-foreground"
                  : "flex-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {active && <span className="text-[13px] font-semibold">{label}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
