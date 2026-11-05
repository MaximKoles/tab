// Тест CSV-импорта/экспорта на файле «Пример заполнения - 2024.csv»
// Запуск: bun scripts/test-csv.ts
import { importFromCsv, exportToCsv } from "../src/lib/csv";

const text = await Bun.file("upload/Пример заполнения - 2024.csv").text();
const res = importFromCsv(text, 2024);

console.log("Операций:", res.operations.length, "| Клиентов:", res.clients.length, "| Пропущено:", res.skipped);
console.log("Клиенты:", res.clients.map((c) => `${c.name}(${c.contact})`).join(", "));
console.log("\nПервая и последняя операции:");
console.log(JSON.stringify(res.operations[0], null, 2));
console.log(JSON.stringify(res.operations[res.operations.length - 1], null, 2));

const deals = res.operations.filter((o) => o.dealId);
console.log("\nСделки (предоплата/остаток):", deals.length);
console.log(deals.map((d) => `${d.clientName} ${d.type} ${d.part} ${d.amount} (всего ${d.dealTotal})`).join("\n"));

// Проверка экспорта: обратная совместимость
const csvOut = exportToCsv(res.operations, res.clients);
const lines = csvOut.split("\n");
console.log("\nЭкспорт CSV — строк:", lines.length);
console.log(lines[0]);
console.log(lines[1]);
console.log(lines[lines.length - 1]);

// Повторный импорт своего же экспорта не должен терять данные
const res2 = importFromCsv(csvOut, 2024);
console.log("\nРеимпорт:", res2.operations.length, "операций,", res2.clients.length, "клиентов");
if (res2.operations.length !== res.operations.length) {
  console.error("ОШИБКА: круговая поездка теряет данные!");
  process.exit(1);
}
console.log("OK: экспорт ↔ импорт согласованы");
