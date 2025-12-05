import sqlite3 from "sqlite3";
import { open } from "sqlite";

export const db = await open({
  filename: "./achady.db",
  driver: sqlite3.Database
});

await db.exec(`
CREATE TABLE IF NOT EXISTS disparos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo TEXT,
  mensagem TEXT,
  produto TEXT,
  data DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);
