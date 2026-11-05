"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Crown } from "lucide-react";
import { useUi } from "@/lib/ui-store";
import { useStore } from "@/lib/store";
import { isPro, PRICE } from "@/lib/limits";

const BENEFITS = [
  "Без лимита операций и клиентов",
  "Импорт вашей таблицы CSV за минуту",
  "Экспорт в CSV и полный бэкап JSON",
  "Аналитика: сравнение лет, цели по доходу",
  "Оценка налога самозанятого (НПД 4% и 6%)",
  "Облачная синхронизация телефон ↔ компьютер",
  "Все будущие обновления бесплатно",
];

export function ProDialog() {
  const { proOpen, closePro, setTab } = useUi();
  const license = useStore((s) => s.license);
  if (isPro(license)) return null;

  return (
    <Dialog open={proOpen} onOpenChange={(v) => !v && closePro()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Гонорар Pro
          </DialogTitle>
          <DialogDescription>
            Разовая оплата — без подписки. Обновления бесплатны.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="rounded-lg bg-muted p-3 text-center">
          <div className="text-2xl font-bold">{PRICE.pro} ₽</div>
          <div className="text-xs text-muted-foreground">
            покупателям таблицы — ранняя цена {PRICE.earlyBird} ₽
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => {
              closePro();
              setTab("settings");
            }}
          >
            Активировать ключ
          </Button>
          <Button variant="outline" onClick={closePro}>
            Позже
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
