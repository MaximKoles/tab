"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowRight,
  ClipboardCopy,
  CloudUpload,
  Crown,
  Database,
  Download,
  Eraser,
  FileUp,
  FlaskConical,
  Lock,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  Search,
  Tags,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useStore, buildSnapshot } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { isPro, PRICE, FREE_LIMITS } from "@/lib/limits";
import { validateKey } from "@/lib/license";
import { importFromCsv, exportToCsv, downloadFile } from "@/lib/csv";
import { totalsForMonth } from "@/lib/analytics";
import { buildMonthReport, copyText } from "@/lib/report";
import { fmtNum, MONTHS_NOM } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  sbGetUser,
  sbPush,
  sbPull,
  sbSignIn,
  sbSignOut,
  sbSignUp,
} from "@/lib/supabase-sync";
import type { SyncSnapshot } from "@/lib/types";

function SectionCard({
  icon: Icon,
  title,
  children,
  locked,
  onLockClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  locked?: boolean;
  onLockClick?: () => void;
}) {
  return (
    <div className="relative rounded-[28px] bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </span>
        <span className="text-sm font-semibold">{title}</span>
        {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className={locked ? "pointer-events-none space-y-3 opacity-50" : "space-y-3"}>
        {children}
      </div>
      {locked && (
        <button
          className="absolute inset-0 z-10 rounded-[28px]"
          onClick={onLockClick}
          aria-label={`${title} доступно в Pro`}
        />
      )}
    </div>
  );
}

function ChipEditor({
  label,
  items,
  onAdd,
  onRemove,
  onRestore,
}: {
  label: string;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  onRestore: (v: string, index: number) => void;
}) {
  const [value, setValue] = useState("");
  // удаление чипа всегда можно отменить: помним исходную позицию
  const remove = (t: string) => {
    const idx = items.indexOf(t);
    onRemove(t);
    toast.success(`«${t}» удалено`, {
      duration: 8000,
      action: {
        label: "Вернуть",
        onClick: () => onRestore(t, idx),
      },
    });
  };
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {items.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1">
            {t}
            <button
              onClick={() => remove(t)}
              aria-label={`Удалить ${t}`}
              className="rounded-full p-0.5 hover:bg-background/80"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Добавить…"
          className="h-9"
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              onAdd(value.trim());
              setValue("");
            }
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => {
            if (value.trim()) {
              onAdd(value.trim());
              setValue("");
            }
          }}
        >
          ОК
        </Button>
      </div>
    </div>
  );
}

export function SettingsView() {
  const store = useStore();
  const { setTab, openSearch, navigateLedger } = useUi();
  const { theme, setTheme } = useTheme();
  const { openPro } = useUi();

  const now = new Date();
  const monthTotals = useMemo(
    () => totalsForMonth(store.operations, now.getFullYear(), now.getMonth() + 1),
    [store.operations]
  );

  // Pro
  const [keyName, setKeyName] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [checking, setChecking] = useState(false);
  const pro = isPro(store.license);

  // CSV
  const csvInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [importYear, setImportYear] = useState(String(new Date().getFullYear()));

  // Sync
  const [sbUrl, setSbUrl] = useState(store.supabase.url);
  const [sbKey, setSbKey] = useState(store.supabase.anonKey);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [cloudTime, setCloudTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const cfg = store.supabase;
    if (!cfg.url || !cfg.anonKey) return;
    sbGetUser(cfg)
      .then((u) => setUser(u?.email ?? null))
      .catch(() => {});
  }, []);

  async function activate() {
    setChecking(true);
    try {
      const ok = await validateKey(keyName, keyValue);
      if (ok) {
        store.setLicense({
          name: keyName.trim(),
          key: keyValue.trim(),
          activatedAt: new Date().toISOString(),
        });
        toast.success("Pro активирован. Спасибо за поддержку!");
        setKeyName("");
        setKeyValue("");
      } else {
        toast.error("Ключ не подходит. Проверьте имя и ключ.");
      }
    } finally {
      setChecking(false);
    }
  }

  function handleCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const res = importFromCsv(String(reader.result ?? ""), Number(importYear));
      if (res.operations.length === 0) {
        toast.error("Не нашёл операций в файле. Проверьте формат (Дата, Сумма, …).");
        return;
      }
      const { ops, clients } = store.applyImport(res.operations, res.clients);
      let max = "";
      for (const o of res.operations) if (o.date > max) max = o.date;
      if (max) navigateLedger(Number(max.slice(0, 4)), Number(max.slice(5, 7)));
      toast.success(`Импортировано ${ops} операций${clients ? `, новых клиентов: ${clients}` : ""}`);
      setTab("ledger");
    };
    reader.readAsText(file, "utf-8");
  }

  function handleJsonFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const snap = JSON.parse(String(reader.result)) as SyncSnapshot;
        if (!snap || snap.version !== 1 || !Array.isArray(snap.operations)) {
          throw new Error("bad");
        }
        store.importSnapshot(snap);
        toast.success("Данные восстановлены из бэкапа");
      } catch {
        toast.error("Не удалось прочитать файл бэкапа");
      }
    };
    reader.readAsText(file);
  }

  async function ensureCfg() {
    const cfg = { url: sbUrl.trim(), anonKey: sbKey.trim() };
    if (!cfg.url || !cfg.anonKey) {
      toast.error("Сначала укажите URL и anon-ключ проекта Supabase");
      return null;
    }
    if (cfg.url !== store.supabase.url || cfg.anonKey !== store.supabase.anonKey) {
      store.setSupabaseConfig(cfg);
    }
    return cfg;
  }

  async function pushCloud() {
    const cfg = await ensureCfg();
    if (!cfg) return;
    setBusy(true);
    try {
      await sbPush(cfg, buildSnapshot());
      toast.success("Данные отправлены в облако");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  }

  async function pullCloud() {
    const cfg = await ensureCfg();
    if (!cfg) return;
    setBusy(true);
    try {
      const snap = await sbPull(cfg);
      if (!snap) {
        toast.error("В облаке пока нет данных");
        return;
      }
      store.importSnapshot(snap);
      toast.success("Данные загружены из облака");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  }

  async function auth(signUp: boolean) {
    const cfg = await ensureCfg();
    if (!cfg) return;
    setBusy(true);
    try {
      if (signUp) {
        await sbSignUp(cfg, email.trim(), password);
        toast.success("Аккаунт создан. Подтвердите почту, если требуется, и войдите.");
      }
      await sbSignIn(cfg, email.trim(), password);
      const u = await sbGetUser(cfg);
      setUser(u?.email ?? null);
      toast.success("Вход выполнен");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const cfg = { url: sbUrl.trim(), anonKey: sbKey.trim() };
    try {
      await sbSignOut(cfg);
      setUser(null);
      setCloudTime(null);
      toast.success("Вы вышли из облака");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4">
      {/* Инструменты */}
      <div className="rounded-[28px] bg-card p-2 shadow-soft">
        <button
          className="flex w-full items-center gap-3 rounded-[20px] px-2 py-2.5 text-left transition-colors hover:bg-muted/60"
          onClick={openSearch}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
            <Search className="h-4 w-4 text-muted-foreground" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Поиск по всем данным</span>
            <span className="block text-xs text-muted-foreground">
              Операции, клиенты, суммы — за любой месяц
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <button
          className="flex w-full items-center gap-3 rounded-[20px] px-2 py-2.5 text-left transition-colors hover:bg-muted/60"
          onClick={async () => {
            if (monthTotals.count === 0) {
              const nom = MONTHS_NOM[now.getMonth()];
              toast.error(`В ${nom}е пока нет операций`);
              return;
            }
            const text = buildMonthReport(store.operations, store.clients, now.getFullYear(), now.getMonth() + 1);
            const ok = await copyText(text);
            if (ok) toast.success("Отчёт за месяц скопирован — вставьте куда нужно");
            else toast.error("Не удалось скопировать отчёт");
          }}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
            <ClipboardCopy className="h-4 w-4 text-muted-foreground" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Отчёт за текущий месяц</span>
            <span className="block text-xs text-muted-foreground">
              Скопировать сводку текстом — бухгалтеру или в заметки
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>

      {/* Pro */}
      <div
        className={cn(
          "rounded-[28px] p-4 shadow-soft",
          pro ? "bg-card" : "bg-lemon-soft"
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Crown className="h-4 w-4" />
          {pro ? "Pro активирован" : "Гонорар Pro"}
          {pro && (
            <span className="rounded-full bg-positive-soft px-2 py-0.5 text-[10px] font-semibold text-positive">
              полная версия
            </span>
          )}
        </div>
        {pro ? (
          <div className="text-sm text-muted-foreground">
            Лицензия на имя <span className="font-medium text-foreground">{store.license!.name}</span>.
            Спасибо, что поддерживаете проект!
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Разовая оплата {PRICE.pro} ₽ (покупателям таблицы — {PRICE.earlyBird} ₽). Без подписки.
              В бесплатной версии: до {FREE_LIMITS.operations} операций и {FREE_LIMITS.clients} клиентов.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="lic-name">Имя (как при оплате)</Label>
                <Input
                  id="lic-name"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="Иван Петров"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lic-key">Ключ</Label>
                <Input
                  id="lic-key"
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX"
                />
              </div>
            </div>
            <Button className="rounded-full" onClick={activate} disabled={checking}>
              {checking ? "Проверяю…" : "Активировать"}
            </Button>
          </>
        )}
      </div>

      {/* Синхронизация */}
      <SectionCard
        icon={RefreshCw}
        title="Облачная синхронизация (Supabase)"
        locked={!pro}
        onLockClick={openPro}
      >
        <p className="text-xs text-muted-foreground">
          Бесплатный проект на supabase.com + таблица из инструкции (DEPLOY.md в проекте).
          Данные переносятся между телефоном и компьютером снимком целиком.
        </p>
        <div className="space-y-2">
          <Input
            value={sbUrl}
            onChange={(e) => setSbUrl(e.target.value)}
            placeholder="https://xxxx.supabase.co"
            aria-label="Supabase URL"
          />
          <Input
            value={sbKey}
            onChange={(e) => setSbKey(e.target.value)}
            placeholder="anon public key (eyJ…)"
            aria-label="Supabase anon key"
            type="password"
          />
        </div>
        {user ? (
          <>
            <div className="flex items-center justify-between rounded-2xl bg-muted px-3.5 py-2.5 text-sm">
              <span className="truncate">{user}</span>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={logout}>
                <LogOut className="mr-1 h-3.5 w-3.5" />
                Выйти
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-full" onClick={pushCloud} disabled={busy}>
                <CloudUpload className="mr-1 h-4 w-4" />
                В облако
              </Button>
              <Button variant="outline" className="rounded-full" onClick={pullCloud} disabled={busy}>
                <Download className="mr-1 h-4 w-4" />
                Из облака
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Почта"
                type="email"
                aria-label="Почта для облака"
              />
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль (от 6 символов)"
                type="password"
                aria-label="Пароль для облака"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="rounded-full" onClick={() => auth(false)} disabled={busy}>
                <LogIn className="mr-1 h-4 w-4" />
                Войти
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => auth(true)} disabled={busy}>
                Регистрация
              </Button>
            </div>
          </>
        )}
      </SectionCard>

      {/* Категории */}
      <SectionCard icon={Tags} title="Категории и источники">
        <ChipEditor
          label="Типы дохода"
          items={store.categories.incomeTypes}
          onAdd={store.addIncomeType}
          onRemove={store.removeIncomeType}
          onRestore={(v, i) => store.restoreCategory("incomeTypes", v, i)}
        />
        <ChipEditor
          label="Источники клиентов"
          items={store.categories.sources}
          onAdd={store.addSource}
          onRemove={store.removeSource}
          onRestore={(v, i) => store.restoreCategory("sources", v, i)}
        />
        <ChipEditor
          label="Типы расхода"
          items={store.categories.expenseTypes}
          onAdd={store.addExpenseType}
          onRemove={store.removeExpenseType}
          onRestore={(v, i) => store.restoreCategory("expenseTypes", v, i)}
        />
      </SectionCard>

      {/* Цель */}
      <SectionCard icon={Target} title="Цель по доходу в месяц" locked={!pro} onLockClick={openPro}>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="goal">Сумма, ₽</Label>
            <Input
              id="goal"
              inputMode="numeric"
              defaultValue={store.settings.monthlyGoal || ""}
              placeholder="Например: 100000"
              onBlur={(e) => {
                const v = parseInt(e.target.value.replace(/\s/g, ""), 10) || 0;
                store.setSettings({ monthlyGoal: v });
                if (v > 0) toast.success("Цель сохранена");
              }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Прогресс до цели показывается на вкладке «Учёт».
        </p>
      </SectionCard>

      {/* Оформление */}
      <SectionCard icon={Moon} title="Оформление">
        <Select value={theme ?? "system"} onValueChange={setTheme}>
          <SelectTrigger aria-label="Тема">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">Как в системе</SelectItem>
            <SelectItem value="light">Светлая</SelectItem>
            <SelectItem value="dark">Тёмная</SelectItem>
          </SelectContent>
        </Select>
      </SectionCard>

      {/* Данные */}
      <SectionCard icon={Database} title="Данные">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="rounded-full"
            disabled={!pro}
            onClick={() => {
              downloadFile(
                `gonorar-${new Date().toISOString().slice(0, 10)}.csv`,
                exportToCsv(store.operations, store.clients),
                "text/csv;charset=utf-8"
              );
              toast.success("CSV сохранён");
            }}
          >
            <Download className="mr-1 h-4 w-4" />
            Экспорт CSV {pro ? "" : "· Pro"}
          </Button>
          <Button variant="outline" className="rounded-full" disabled={!pro} onClick={() => csvInputRef.current?.click()}>
            <FileUp className="mr-1 h-4 w-4" />
            Импорт CSV {pro ? "" : "· Pro"}
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              downloadFile(
                `gonorar-backup-${new Date().toISOString().slice(0, 10)}.json`,
                JSON.stringify(buildSnapshot(), null, 2),
                "application/json"
              );
              toast.success("Бэкап JSON сохранён");
            }}
          >
            <Download className="mr-1 h-4 w-4" />
            Бэкап JSON
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => jsonInputRef.current?.click()}>
            <FileUp className="mr-1 h-4 w-4" />
            Восстановить JSON
          </Button>
        </div>

        {!pro && (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="imp-year">Год для импорта CSV</Label>
              <Select value={importYear} onValueChange={setImportYear}>
                <SelectTrigger id="imp-year" disabled={!pro}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {pro && (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="imp-year-pro">Год дат без года в файле</Label>
              <Select value={importYear} onValueChange={setImportYear}>
                <SelectTrigger id="imp-year-pro">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Импорт CSV понимает формат вашей таблицы: Дата, Сумма, Тип, Описание, Имя, Контакты,
          Источник, Коммент. Строки с отрицательной суммой станут расходами.
        </p>

        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => {
            store.loadDemo();
            // открываем месяц последних демо-данных
            let max = "";
            for (const o of useStore.getState().operations) if (o.date > max) max = o.date;
            if (max) navigateLedger(Number(max.slice(0, 4)), Number(max.slice(5, 7)));
            toast.success("Загружены демо-данные из примера таблицы");
            setTab("ledger");
          }}
        >
          <FlaskConical className="mr-1 h-4 w-4" />
          Загрузить демо-данные
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="rounded-full text-destructive hover:text-destructive">
              <Eraser className="mr-1 h-4 w-4" />
              Очистить все данные
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить все операции и клиентов?</AlertDialogTitle>
              <AlertDialogDescription>
                Действие необратимо. Сначала сделайте бэкап JSON, если данные нужны.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Отмена</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  store.clearAll();
                  toast.success("Данные очищены");
                }}
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCsvFile(f);
            e.target.value = "";
          }}
        />
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleJsonFile(f);
            e.target.value = "";
          }}
        />
      </SectionCard>

      {/* О приложении */}
      <div className="rounded-[28px] bg-card p-4 text-sm leading-relaxed text-muted-foreground shadow-soft">
        <div className="mb-2 text-sm font-semibold text-foreground">О приложении</div>
        <p>
          «Гонорар» — учёт денег фрилансера без бухгалтерии: клиенты, предоплаты, источники
          заказов и прибыль на одном экране.
        </p>
        <p className="mt-2">
          Все данные хранятся в браузере вашего устройства и никуда не отправляются. Для
          переноса используйте бэкап JSON или облачную синхронизацию.
        </p>
        <p className="mt-2">
          Установите приложение на телефон: в меню браузера выберите «Добавить на главный
          экран» — оно будет работать офлайн.
        </p>
        <p className="mt-2 text-xs">Версия 1.1.0</p>
      </div>

      <div className="h-2" />
    </div>
  );
}
