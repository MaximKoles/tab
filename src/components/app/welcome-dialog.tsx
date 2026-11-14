"use client";

// Онбординг при первом запуске: главный сценарий продажи — переезд из существующей
// таблицы учёта. Показывается, пока данных нет и пользователь не сделал выбор.

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, FileSpreadsheet, FileUp, FlaskConical, PencilLine, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { importFromCsv } from "@/lib/csv";

const FLAG = "gonorar-welcome-done";
const YEARS = [2023, 2024, 2025, 2026, 2027];

const POINTS = [
  "Запись дохода за 10 секунд — сумма, услуга, клиент",
  "Видно, откуда приходят деньги и какой прогресс",
  "Работает на телефоне и компьютере, данные только у вас",
];

/** Месяц самой поздней операции — куда открыть «Учёт» после импорта */
function latestMonth(ops: Array<{ date: string }>) {
  let max = "";
  for (const o of ops) if (o.date > max) max = o.date;
  if (!max) return null;
  return { y: Number(max.slice(0, 4)), m: Number(max.slice(5, 7)) };
}

export function WelcomeDialog() {
  const operations = useStore((s) => s.operations);
  const clients = useStore((s) => s.clients);
  const applyImport = useStore((s) => s.applyImport);
  const loadDemo = useStore((s) => s.loadDemo);
  const navigateLedger = useUi((s) => s.navigateLedger);

  const fileRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState<"choose" | "preview">("choose");
  const [csv, setCsv] = useState<string | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  if (operations.length > 0 || clients.length > 0) return null;
  if (!visible || (typeof window !== "undefined" && localStorage.getItem(FLAG) === "1")) return null;

  const done = () => {
    try {
      localStorage.setItem(FLAG, "1");
    } catch {}
    setVisible(false);
  };

  const preview = csv ? importFromCsv(csv, Number(year)) : null;

  function pickFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const res = importFromCsv(text, Number(year));
      if (res.operations.length === 0) {
        toast.error("Не нашёл операций в файле. Проверьте, что это выгрузка таблицы в CSV.");
        return;
      }
      setCsv(text);
      setStep("preview");
    };
    reader.readAsText(file, "utf-8");
  }

  function confirmImport() {
    if (!csv) return;
    const res = importFromCsv(csv, Number(year));
    const { ops, clients: newClients } = applyImport(res.operations, res.clients);
    const nav = latestMonth(res.operations);
    if (nav) navigateLedger(nav.y, nav.m);
    toast.success(`Перенесено: ${ops} операций${newClients ? `, клиентов: ${newClients}` : ""}. Добро пожаловать!`);
    done();
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {step === "choose" ? (
          <>
            <DialogHeader className="items-center text-center sm:text-center">
              <span className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/25">
                <Wallet className="h-7 w-7 text-white" />
              </span>
              <DialogTitle className="text-xl">Гонорар</DialogTitle>
              <DialogDescription className="text-center">
                Учёт доходов фрилансера — вместо таблицы, но по её привычной логике
              </DialogDescription>
            </DialogHeader>

            <ul className="space-y-1.5 py-1">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-muted-foreground">{p}</span>
                </li>
              ))}
            </ul>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.target.value = "";
              }}
            />

            <div className="flex flex-col gap-2 pt-1">
              <Button onClick={() => fileRef.current?.click()} className="h-11 text-base font-semibold">
                <FileUp className="h-4 w-4" />
                Перенести мою таблицу
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Выгрузите таблицу в CSV (Файл → Скачать → CSV в Google Sheets) — колонки
                «Дата, Сумма, Тип, Имя, Источник» распознаются сами
              </p>
              <Button variant="outline" className="h-10" onClick={() => { loadDemo(); done(); }}>
                <FlaskConical className="h-4 w-4" />
                Посмотреть на демо-данных
              </Button>
              <Button variant="ghost" className="h-9 text-muted-foreground" onClick={done}>
                <PencilLine className="h-4 w-4" />
                Начать с чистого листа
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Таблица прочитана
              </DialogTitle>
              <DialogDescription>
                Проверьте, что распознано верно, и перенесите данные в приложение
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-muted p-3 text-center">
                <div className="text-2xl font-extrabold tabular-nums">{preview?.operations.length ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">операций</div>
              </div>
              <div className="rounded-xl bg-muted p-3 text-center">
                <div className="text-2xl font-extrabold tabular-nums">{preview?.clients.length ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">клиентов</div>
              </div>
            </div>

            {!!preview?.skipped && (
              <p className="text-xs text-muted-foreground">
                Пропущено строк без суммы или даты: {preview.skipped}
              </p>
            )}

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Даты без года («1 янв.») относим к году:
              </p>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger aria-label="Год таблицы">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button onClick={confirmImport} className="h-11 text-base font-semibold">
                Перенести в приложение
              </Button>
              <Button
                variant="outline"
                className="h-9"
                onClick={() => {
                  setCsv(null);
                  setStep("choose");
                }}
              >
                Выбрать другой файл
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
