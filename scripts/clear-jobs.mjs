import fs from "fs";
import { neon } from "@neondatabase/serverless";

const envText = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
}

const databaseUrl = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");
const sql = neon(databaseUrl);

const before = await sql`SELECT COUNT(*)::int AS c FROM Jobs`;

// Feedback has no ON DELETE CASCADE
await sql`DELETE FROM Feedback`;
await sql`DELETE FROM Jobs`;

const after = await sql`SELECT COUNT(*)::int AS jobs FROM Jobs`;
const bids = await sql`SELECT COUNT(*)::int AS c FROM Bids`;
const jobSkills = await sql`SELECT COUNT(*)::int AS c FROM JobSkill`;

console.log(
  JSON.stringify({
    deleted_jobs: before[0].c,
    jobs_left: after[0].jobs,
    bids_left: bids[0].c,
    job_skills_left: jobSkills[0].c,
  })
);
