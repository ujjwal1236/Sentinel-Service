import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import { ENV } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(__dirname, "../../sentinel.db");

export const dbPromise = open({
  filename: ENV.DB_PATH || defaultDbPath,
  driver: sqlite3.Database
});