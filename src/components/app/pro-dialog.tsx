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
  "Облачная синхронизация телефон ↔ компьютер",
  "Все будущие обновления бесплатно",
];

export function ProDialog() {
  const { proOpen, closePro, setTab } = useUi();
  const license = useStore((s) => s.license);
  if (isPro(license)) return null;

  return (
    <Dialog open={proOpen} onOpenChange={(v) => !v && closePro()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Гонорар Pro
          </DialogTitle>
          <DialogDescription>
            Разовая оплата — без подписки. Обновления бесплатны.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="rounded-[18px] bg-lemon-soft p-3 text-center">
          <div className="text-2xl font-bold">{PRICE.pro} ₽</div>
          <div className="text-xs text-muted-foreground">
            покупателям таблицы — ранняя цена {PRICE.earlyBird} ₽
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            className="h-11 rounded-full font-semibold"
            onClick={() => {
              closePro();
              setTab("settings");
            }}
          >
            Активировать ключ
          </Button>
          <Button variant="outline" className="h-10 rounded-full" onClick={closePro}>
            Позже
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
