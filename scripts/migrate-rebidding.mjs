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

await sql`
CREATE OR REPLACE FUNCTION create_bid(
  p_job_id INTEGER,
  p_actor INTEGER,
  p_amount NUMERIC
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
  v_bid_id INTEGER;
BEGIN
  SELECT role INTO v_role FROM Users WHERE user_id = p_actor;
  IF v_role IS DISTINCT FROM 'freelancer' THEN
    RAISE EXCEPTION 'Only freelancers can place bids';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Bid amount must be positive';
  END IF;
  IF EXISTS (
    SELECT 1 FROM Bids
    WHERE job_id = p_job_id
      AND freelancer_id = p_actor
      AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'You already have an accepted bid on this job';
  END IF;
  DELETE FROM Bids
  WHERE job_id = p_job_id
    AND freelancer_id = p_actor
    AND status IN ('pending', 'rejected');
  PERFORM set_config('app.user_id', p_actor::TEXT, true);
  INSERT INTO Bids (job_id, freelancer_id, bid_amount, status, created_at)
  VALUES (p_job_id, p_actor, p_amount, 'pending', timezone('utc', now()))
  RETURNING bid_id INTO v_bid_id;
  RETURN v_bid_id;
END;
$$;
`;

console.log(JSON.stringify({ ok: true, migrated: "create_bid rebid support" }));
