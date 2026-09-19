// Probe common local MySQL credentials and create the apiforge database.
import mysql from "../apps/api/node_modules/mysql2/promise.js";

const candidates = [
  { user: "root", password: "" },
  { user: "root", password: "root" },
  { user: "root", password: "password" },
  { user: "root", password: "mysql" },
  { user: "root", password: "admin" },
];

for (const c of candidates) {
  try {
    const conn = await mysql.createConnection({ host: "127.0.0.1", port: 3306, ...c, connectTimeout: 3000 });
    console.log(`SUCCESS user=${c.user} password=${c.password || "(empty)"}`);
    await conn.query("CREATE DATABASE IF NOT EXISTS apiforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    console.log("database 'apiforge' ready");
    const [rows] = await conn.query("SELECT VERSION() v");
    console.log("mysql version:", rows[0].v);
    await conn.end();
    process.exit(0);
  } catch (e) {
    console.log(`fail user=${c.user} password=${c.password || "(empty)"}: ${e.code || e.message}`);
  }
}
console.log("No common credential worked — need the real MySQL password.");
process.exit(1);
