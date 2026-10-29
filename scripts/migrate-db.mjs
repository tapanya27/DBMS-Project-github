import fs from "fs";
import { neon } from "@neondatabase/serverless";

const envText = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
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
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const sql = neon(databaseUrl);

const prep = [
  `CREATE TABLE IF NOT EXISTS Skill (
     skill_id SERIAL PRIMARY KEY,
     skill_name TEXT NOT NULL UNIQUE
   )`,
  `CREATE TABLE IF NOT EXISTS UserSkill (
     user_id INTEGER NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
     skill_id INTEGER NOT NULL REFERENCES Skill(skill_id),
     PRIMARY KEY (user_id, skill_id)
   )`,
  `CREATE TABLE IF NOT EXISTS JobSkill (
     job_id INTEGER NOT NULL REFERENCES Jobs(job_id) ON DELETE CASCADE,
     skill_id INTEGER NOT NULL REFERENCES Skill(skill_id),
     PRIMARY KEY (job_id, skill_id)
   )`,
  `DO $$
   BEGIN
     IF EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'skills'
     ) THEN
       INSERT INTO Skill (skill_name)
       SELECT DISTINCT skill_name FROM Skills
       WHERE skill_name IS NOT NULL AND btrim(skill_name) <> ''
       ON CONFLICT (skill_name) DO NOTHING;
       INSERT INTO UserSkill (user_id, skill_id)
       SELECT DISTINCT s.user_id, sk.skill_id
       FROM Skills s
       JOIN Skill sk ON sk.skill_name = s.skill_name
       ON CONFLICT DO NOTHING;
       DROP TABLE Skills;
     END IF;
     IF EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'skillsrequired'
     ) THEN
       INSERT INTO Skill (skill_name)
       SELECT DISTINCT skill_name FROM SkillsRequired
       WHERE skill_name IS NOT NULL AND btrim(skill_name) <> ''
       ON CONFLICT (skill_name) DO NOTHING;
       INSERT INTO JobSkill (job_id, skill_id)
       SELECT DISTINCT sr.job_id, sk.skill_id
       FROM SkillsRequired sr
       JOIN Skill sk ON sk.skill_name = sr.skill_name
       ON CONFLICT DO NOTHING;
       DROP TABLE SkillsRequired;
     END IF;
   END $$`,
  `DELETE FROM Bids a
   USING Bids b
   WHERE a.job_id = b.job_id
     AND a.freelancer_id = b.freelancer_id
     AND a.bid_id < b.bid_id`,
  `DELETE FROM Feedback a
   USING Feedback b
   WHERE a.job_id = b.job_id
     AND a.from_user_id = b.from_user_id
     AND a.feedback_id < b.feedback_id`,
  `DO $$
   BEGIN
     ALTER TABLE Jobs ADD CONSTRAINT jobs_status_check
       CHECK (status IN ('open', 'in progress', 'completed'));
   EXCEPTION WHEN duplicate_object OR unique_violation OR duplicate_table THEN NULL;
   END $$`,
  `DO $$
   BEGIN
     ALTER TABLE Bids ADD CONSTRAINT bids_status_check
       CHECK (status IN ('pending', 'accepted', 'rejected'));
   EXCEPTION WHEN duplicate_object OR unique_violation OR duplicate_table THEN NULL;
   END $$`,
  `DO $$
   BEGIN
     ALTER TABLE Bids ADD CONSTRAINT bids_one_per_freelancer
       UNIQUE (job_id, freelancer_id);
   EXCEPTION WHEN duplicate_object OR unique_violation OR duplicate_table THEN NULL;
   END $$`,
  `DO $$
   BEGIN
     ALTER TABLE Feedback ADD CONSTRAINT feedback_rating_check
       CHECK (rating >= 1 AND rating <= 5);
   EXCEPTION WHEN duplicate_object OR unique_violation OR duplicate_table THEN NULL;
   END $$`,
  `DO $$
   BEGIN
     ALTER TABLE Feedback ADD CONSTRAINT feedback_once_per_reviewer
       UNIQUE (job_id, from_user_id);
   EXCEPTION WHEN duplicate_object OR unique_violation OR duplicate_table THEN NULL;
   END $$`,
  `DO $$
   BEGIN
     ALTER TABLE Users ADD CONSTRAINT users_role_check
       CHECK (role IN ('client', 'freelancer'));
   EXCEPTION WHEN duplicate_object OR unique_violation OR duplicate_table THEN NULL;
   END $$`,
];

const schema = fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
const statements = [...prep, ...splitSql(schema)];

for (const statement of statements) {
  const preview = statement.replace(/\s+/g, " ").slice(0, 80);
  try {
    await sql(statement);
    console.log("ok", preview);
  } catch (error) {
    console.error("FAILED", preview);
    console.error(error.message || error);
    process.exit(1);
  }
}

await sql`
  UPDATE Users u
  SET rating = COALESCE((
    SELECT ROUND(AVG(f.rating)::numeric, 1)
    FROM Feedback f
    WHERE f.to_user_id = u.user_id
  ), 0)
`;

const checks = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;
console.log(checks.map((row) => row.table_name).join(", "));
