# Гонорар — деплой и запуск

Веб-приложение для учёта доходов фрилансера. Полностью работает в браузере
(данные — на устройстве пользователя), поэтому размещается на любом статическом
хостинге: GitHub Pages, Netlify, любой CDN.

## 1. GitHub Pages (выгрузка статики)

```bash
# без префикса (репозиторий username.github.io или свой домен):
EXPORT=1 bun run build          # статика появится в папке out/

# для обычного репозитория https://username.github.io/repo-name/ :
EXPORT=1 NEXT_PUBLIC_BASE_PATH=/repo-name bun run build
```

Затем загрузите содержимое `out/` в ветку `gh-pages`:

```bash
cd out
git init && git add -A && git commit -m "deploy"
git push -f https://github.com/USERNAME/REPO.git main:gh-pages
```

В настройках репозитория: Settings → Pages → Source: `gh-pages` branch.
Удобно автоматизировать GitHub Actions (Deploy static content to Pages) —
шаблон предлагается сам в разделе Actions.

Требования выполнены: приложение не использует серверных маршрутов, все пути
в манифесте и иконках относительные, service worker регистрируется от места
запуска. Лимиты Pages (100 ГБ трафика/мес, 1 ГБ размер) для этого продукта
не достижимы.

## 2. Облачная синхронизация (Supabase, опционально)

1. Создайте бесплатный проект на supabase.com.
2. SQL Editor → выполните:

```sql
create table if not exists gonorar_backups (
  user_id uuid primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table gonorar_backups enable row level security;

create policy "own row read" on gonorar_backups
  for select using (auth.uid() = user_id);
create policy "own row write" on gonorar_backups
  for insert with check (auth.uid() = user_id);
create policy "own row update" on gonorar_backups
  for update using (auth.uid() = user_id);
```

3. Settings → API: скопируйте Project URL и anon public key.
4. В приложении: «Ещё» → Облачная синхронизация → вставьте URL и ключ →
   Регистрация/Войти → «В облако» / «Из облака».

Синхронизация снимком целиком: последняя отправка перезаписывает облако,
загрузка из облака заменяет локальные данные. Этого достаточно для переноса
между телефоном и компьютером одного человека.

## 3. Продажа Pro и генерация ключей

Free-версия ограничена 30 операциями и 10 клиентами (константы в
`src/lib/limits.ts`). После оплаты покупатель вводит имя и ключ в
«Ещё» → Гонорар Pro.

Выдача ключа после оплаты (ЮKassa/Boosty/перевод):

```bash
node scripts/gen-key.mjs "Имя Покупателя"
# Имя:  Имя Покупателя
# Ключ: 8FD9-BFC8-C0D1
```

Проверка работает офлайн: ключ = HMAC-SHA256(секрет, имя в нижнем регистре),
первые 12 символов. Секрет лежит в `src/lib/license.ts` и `scripts/gen-key.mjs`
и должен совпадать. Чтобы отозвать старые ключи — поменяйте секрет в обоих
файлах и пересоберите.

Важно: защита условная (секрет виден в коде страницы). Для аудитории 990 ₽
это приемлемо; при росте цены переходите на чек-сервер или Supabase-валидацию.

Цены настраиваются в `src/lib/limits.ts` (PRICE.pro, PRICE.earlyBird).

## 4. Telegram Mini App (тот же код)

1. @BotFather → /newbot → получите токен бота.
2. /newapp или Bot Settings → Menu Button → укажите URL задеплоенного сайта
   (GitHub Pages подходит: Mini App — это обычная веб-страница внутри Telegram).
3. Приложение при открытии в Telegram автоматически вызывает `tg.expand()`
   (см. `src/app/page.tsx`).

Приём оплаты внутри Telegram — платёжные ссылки ЮKassa (самозанятый может
пробивать чеки через «Мой налог», комиссия ~3,5%).

## 5. Локальная разработка

```bash
bun install
bun run dev        # http://localhost:3000
bun run lint
bun scripts/test-csv.ts   # тест миграции CSV из старой таблицы
node scripts/gen-icons.mjs # перегенерация иконок PWA
```

## Структура

- `src/lib/store.ts` — состояние (zustand + localStorage, ключ `gonorar-v1`)
- `src/lib/csv.ts` — импорт/экспорт CSV формата «Пример заполнения — 2024»
- `src/lib/analytics.ts` — агрегации: итоги, сделки, рейтинги источников
- `src/lib/license.ts` — офлайн-проверка Pro-ключей
- `src/lib/supabase-sync.ts` — облачная синхронизация
- `src/components/app/*` — экраны: Учёт, Клиенты, Аналитика, Настройки
