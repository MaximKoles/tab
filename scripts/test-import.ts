import { readFileSync } from "fs";
import { importFromCsv } from "../src/lib/csv";

const text = readFileSync("/home/z/my-project/upload/Пример заполнения - 2024.csv", "utf-8");
const res = importFromCsv(text, 2024);
console.log("operations:", res.operations.length, "clients:", res.clients.length, "skipped:", res.skipped);
console.log("first:", res.operations.slice(0, 3).map(o => `${o.date} ${o.amount} ${o.type} ${o.clientName ?? ""} src=${o.source ?? ""}`));
console.log("last:", res.operations.slice(-2).map(o => `${o.date} ${o.amount} ${o.kind}`));
