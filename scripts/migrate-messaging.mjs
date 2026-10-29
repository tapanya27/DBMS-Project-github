import fs from "fs";
import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "crypto";

const envPath = new URL("../.env.local", import.meta.url);
let envText = fs.readFileSync(envPath, "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
}

if (!process.env.MESSAGE_ENCRYPTION_KEY) {
  const key = createHash("sha256")
    .update(randomBytes(32))
    .digest("hex");
  envText = envText.trimEnd() + `\nMESSAGE_ENCRYPTION_KEY=${key}\n`;
  fs.writeFileSync(envPath, envText, "utf8");
  process.env.MESSAGE_ENCRYPTION_KEY = key;
  console.log("Added MESSAGE_ENCRYPTION_KEY to .env.local");
}

function splitSql(sqlText) {
  const statements = [];
  let current = "";
  let dollar = null;
  for (let i = 0; i < sqlText.length; i++) {
    if (!dollar && sqlText.startsWith("--", i)) {
      const end = sqlText.indexOf("\n", i);
      i = end === -1 ? sqlText.length : end;
      continue;
    }
    if (sqlText[i] === "$") {
      const match = sqlText.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        if (!dollar) dollar = match[0];
        else if (dollar === match[0]) dollar = null;
        current += match[0];
        i += match[0].length - 1;
        continue;
      }
    }
    if (sqlText[i] === ";" && !dollar) {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += sqlText[i];
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

const databaseUrl = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL;
const sql = neon(databaseUrl);
const schema = fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
const start = schema.indexOf("CREATE TABLE IF NOT EXISTS Notifications");
if (start < 0) throw new Error("Messaging schema block missing");
const statements = splitSql(schema.slice(start));

for (const statement of statements) {
  const preview = statement.replace(/\s+/g, " ").slice(0, 70);
  await sql(statement);
  console.log("ok", preview);
}

console.log("messaging schema applied");
