// Тест buildMonthReport на демо-данных
import { demoOperations, demoClients } from "../src/lib/demo";
import { buildMonthReport } from "../src/lib/report";

const ops = demoOperations();
const clients = demoClients();

console.log("=== Отчёт за май ===");
console.log(buildMonthReport(ops, clients, 2026, 5));
console.log();
console.log("=== Отчёт за пустой месяц ===");
console.log(buildMonthReport(ops, clients, 2026, 11));
