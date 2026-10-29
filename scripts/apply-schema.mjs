import fs from "fs";
import { neon } from "@neondatabase/serverless";

const envText = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
}

const sql = neon(process.env.NEXT_PUBLIC_DATABASE_URL);
const schema = fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
const statements = schema
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql(statement);
}

const clerkResponse = await fetch("https://api.clerk.com/v1/users?limit=100", {
  headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
});
if (!clerkResponse.ok) {
  throw new Error(`Clerk user lookup failed with status ${clerkResponse.status}`);
}
const clerkUsers = await clerkResponse.json();

let createdProfiles = 0;
for (const clerkUser of clerkUsers) {
  const email = clerkUser.email_addresses?.[0]?.email_address;
  if (!email) continue;
  const name =
    [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(" ") ||
    email.split("@")[0];
  const inserted = await sql`
    INSERT INTO Users (name, email, role, rating)
    VALUES (${name}, ${email}, 'client', 0.0)
    ON CONFLICT (email) DO NOTHING
    RETURNING user_id
  `;
  createdProfiles += inserted.length;
}

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;
const users = await sql`SELECT COUNT(*)::int AS count FROM Users`;

console.log(
  JSON.stringify({
    tables: tables.map((row) => row.table_name),
    users: users[0].count,
    createdProfiles,
  })
);
