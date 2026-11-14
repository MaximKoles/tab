import { readFileSync } from "fs";
import { parseCsv } from "../src/lib/csv";

const text = readFileSync("/home/z/my-project/upload/Пример заполнения - 2024.csv", "utf-8");
const rows = parseCsv(text);
console.log("parsed rows:", rows.length);
console.log("rows with amount col non-empty:", rows.filter(r => (r[1] ?? "").trim() !== "").length);
// где обрыв?
for (let i = 10; i < Math.min(20, rows.length); i++) {
  console.log(i, JSON.stringify(rows[i].slice(0, 4)));
}
