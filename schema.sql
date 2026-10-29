-- Contractor marketplace schema.
-- Skills are a catalog. Users and jobs reference that catalog.

CREATE TABLE IF NOT EXISTS Users (
  user_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  rating NUMERIC(3, 1) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_role_check CHECK (role IN ('client', 'freelancer'))
);

CREATE TABLE IF NOT EXISTS Skill (
  skill_id SERIAL PRIMARY KEY,
  skill_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS UserSkill (
  user_id INTEGER NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES Skill(skill_id),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS Jobs (
  job_id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  budget NUMERIC(12, 2) NOT NULL,
  deadline TIMESTAMP NOT NULL,
  client_id INTEGER NOT NULL REFERENCES Users(user_id),
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT jobs_status_check CHECK (status IN ('open', 'in progress', 'completed'))
);

CREATE TABLE IF NOT EXISTS JobSkill (
  job_id INTEGER NOT NULL REFERENCES Jobs(job_id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES Skill(skill_id),
  PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE IF NOT EXISTS Bids (
  bid_id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES Jobs(job_id) ON DELETE CASCADE,
  freelancer_id INTEGER NOT NULL REFERENCES Users(user_id),
  bid_amount NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bids_status_check CHECK (status IN ('pending', 'accepted', 'rejected')),
  CONSTRAINT bids_one_per_freelancer UNIQUE (job_id, freelancer_id)
);

CREATE TABLE IF NOT EXISTS Feedback (
  feedback_id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES Jobs(job_id),
  from_user_id INTEGER NOT NULL REFERENCES Users(user_id),
  to_user_id INTEGER NOT NULL REFERENCES Users(user_id),
  rating NUMERIC(2, 1) NOT NULL,
  CONSTRAINT feedback_rating_check CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT feedback_once_per_reviewer UNIQUE (job_id, from_user_id)
);

CREATE TABLE IF NOT EXISTS StatusAudit (
  audit_id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  old_status TEXT,
  new_status TEXT,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by INTEGER REFERENCES Users(user_id)
);

CREATE INDEX IF NOT EXISTS bids_job_status_idx ON Bids (job_id, status);
CREATE INDEX IF NOT EXISTS jobs_client_status_idx ON Jobs (client_id, status);

CREATE OR REPLACE VIEW open_jobs AS
SELECT
  j.job_id,
  j.title,
  j.description,
  j.budget,
  j.deadline,
  u.name AS client_name,
  COALESCE(ARRAY_AGG(s.skill_name) FILTER (WHERE s.skill_name IS NOT NULL), '{}') AS skills_required
FROM Jobs j
JOIN Users u ON j.client_id = u.user_id
LEFT JOIN JobSkill js ON j.job_id = js.job_id
LEFT JOIN Skill s ON js.skill_id = s.skill_id
WHERE j.status = 'open'
GROUP BY j.job_id, u.name;

CREATE OR REPLACE VIEW bid_vs_budget AS
SELECT
  j.job_id,
  j.title,
  j.budget,
  ROUND(AVG(b.bid_amount), 2) AS average_bid,
  ROUND(AVG(b.bid_amount) - j.budget, 2) AS difference
FROM Jobs j
LEFT JOIN Bids b ON b.job_id = j.job_id
GROUP BY j.job_id
ORDER BY j.job_id;

CREATE OR REPLACE VIEW freelancer_rank AS
SELECT
  u.user_id,
  u.name,
  u.rating,
  COUNT(b.bid_id) FILTER (WHERE b.status = 'accepted') AS accepted_jobs
FROM Users u
LEFT JOIN Bids b ON b.freelancer_id = u.user_id
WHERE u.role = 'freelancer'
GROUP BY u.user_id
ORDER BY u.rating DESC, accepted_jobs DESC;

CREATE OR REPLACE VIEW top_clients AS
SELECT
  u.user_id,
  u.name,
  COUNT(j.job_id) AS completed_jobs
FROM Users u
JOIN Jobs j ON j.client_id = u.user_id AND j.status = 'completed'
GROUP BY u.user_id
ORDER BY completed_jobs DESC;

CREATE OR REPLACE VIEW jobs_without_bids AS
SELECT j.job_id, j.title, j.budget, u.name AS client_name
FROM Jobs j
JOIN Users u ON u.user_id = j.client_id
WHERE NOT EXISTS (SELECT 1 FROM Bids b WHERE b.job_id = j.job_id);

CREATE OR REPLACE VIEW monthly_job_counts AS
SELECT
  to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
  COUNT(*) AS jobs_posted,
  COUNT(*) FILTER (WHERE status = 'completed') AS jobs_completed
FROM Jobs
GROUP BY date_trunc('month', created_at)
ORDER BY date_trunc('month', created_at);

CREATE OR REPLACE FUNCTION prevent_invalid_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  job_status TEXT;
  client INTEGER;
BEGIN
  SELECT status, client_id INTO job_status, client
  FROM Jobs
  WHERE job_id = NEW.job_id;
  IF job_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Bids are closed for this job';
  END IF;
  IF client = NEW.freelancer_id THEN
    RAISE EXCEPTION 'You cannot bid on your own job';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bids_prevent_invalid ON Bids;
CREATE TRIGGER bids_prevent_invalid
BEFORE INSERT ON Bids
FOR EACH ROW
EXECUTE FUNCTION prevent_invalid_bid();

CREATE OR REPLACE FUNCTION refresh_user_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE Users
  SET rating = COALESCE((
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM Feedback
    WHERE to_user_id = COALESCE(NEW.to_user_id, OLD.to_user_id)
  ), 0)
  WHERE user_id = COALESCE(NEW.to_user_id, OLD.to_user_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS feedback_refresh_rating ON Feedback;
CREATE TRIGGER feedback_refresh_rating
AFTER INSERT OR UPDATE OR DELETE ON Feedback
FOR EACH ROW
EXECUTE FUNCTION refresh_user_rating();

CREATE OR REPLACE FUNCTION audit_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  actor INTEGER;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    actor := NULLIF(current_setting('app.user_id', true), '')::INTEGER;
    INSERT INTO StatusAudit (table_name, record_id, old_status, new_status, changed_by)
    VALUES (
      TG_TABLE_NAME,
      CASE WHEN TG_TABLE_NAME = 'jobs' THEN NEW.job_id ELSE NEW.bid_id END,
      OLD.status,
      NEW.status,
      actor
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_audit_status ON Jobs;
CREATE TRIGGER jobs_audit_status
AFTER UPDATE ON Jobs
FOR EACH ROW
EXECUTE FUNCTION audit_status_change();

DROP TRIGGER IF EXISTS bids_audit_status ON Bids;
CREATE TRIGGER bids_audit_status
AFTER UPDATE ON Bids
FOR EACH ROW
EXECUTE FUNCTION audit_status_change();

CREATE OR REPLACE FUNCTION replace_user_skills(p_user_id INTEGER, p_skills TEXT[])
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_skill TEXT;
  v_skill_id INTEGER;
BEGIN
  DELETE FROM UserSkill WHERE user_id = p_user_id;
  IF p_skills IS NULL THEN
    RETURN;
  END IF;
  FOREACH v_skill IN ARRAY p_skills LOOP
    IF v_skill IS NULL OR btrim(v_skill) = '' THEN
      CONTINUE;
    END IF;
    INSERT INTO Skill (skill_name)
    VALUES (btrim(v_skill))
    ON CONFLICT (skill_name) DO UPDATE SET skill_name = EXCLUDED.skill_name
    RETURNING skill_id INTO v_skill_id;
    INSERT INTO UserSkill (user_id, skill_id)
    VALUES (p_user_id, v_skill_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION post_job(
  p_title TEXT,
  p_description TEXT,
  p_budget NUMERIC,
  p_deadline TIMESTAMP,
  p_client_id INTEGER,
  p_skills TEXT[]
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_id INTEGER;
  v_skill TEXT;
  v_skill_id INTEGER;
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM Users WHERE user_id = p_client_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Unknown user';
  END IF;
  IF v_role <> 'client' THEN
    RAISE EXCEPTION 'Only clients can post jobs';
  END IF;
  INSERT INTO Jobs (title, description, budget, deadline, client_id, status)
  VALUES (p_title, p_description, p_budget, p_deadline, p_client_id, 'open')
  RETURNING job_id INTO v_job_id;
  IF p_skills IS NOT NULL THEN
    FOREACH v_skill IN ARRAY p_skills LOOP
      IF v_skill IS NULL OR btrim(v_skill) = '' THEN
        CONTINUE;
      END IF;
      INSERT INTO Skill (skill_name)
      VALUES (btrim(v_skill))
      ON CONFLICT (skill_name) DO UPDATE SET skill_name = EXCLUDED.skill_name
      RETURNING skill_id INTO v_skill_id;
      INSERT INTO JobSkill (job_id, skill_id)
      VALUES (v_job_id, v_skill_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  RETURN v_job_id;
END;
$$;

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
  PERFORM set_config('app.user_id', p_actor::TEXT, true);
  INSERT INTO Bids (job_id, freelancer_id, bid_amount, status, created_at)
  VALUES (p_job_id, p_actor, p_amount, 'pending', CURRENT_TIMESTAMP)
  RETURNING bid_id INTO v_bid_id;
  RETURN v_bid_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_bid_amount(
  p_bid_id INTEGER,
  p_actor INTEGER,
  p_amount NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner INTEGER;
  v_status TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Bid amount must be positive';
  END IF;
  SELECT freelancer_id, status INTO v_owner, v_status
  FROM Bids WHERE bid_id = p_bid_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Bid not found';
  END IF;
  IF v_owner <> p_actor THEN
    RAISE EXCEPTION 'You can only edit your own bids';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending bids can be edited';
  END IF;
  PERFORM set_config('app.user_id', p_actor::TEXT, true);
  UPDATE Bids SET bid_amount = p_amount WHERE bid_id = p_bid_id;
END;
$$;

CREATE OR REPLACE FUNCTION delete_bid(
  p_bid_id INTEGER,
  p_actor INTEGER
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner INTEGER;
  v_status TEXT;
BEGIN
  SELECT freelancer_id, status INTO v_owner, v_status
  FROM Bids WHERE bid_id = p_bid_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Bid not found';
  END IF;
  IF v_owner <> p_actor THEN
    RAISE EXCEPTION 'You can only delete your own bids';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending bids can be deleted';
  END IF;
  PERFORM set_config('app.user_id', p_actor::TEXT, true);
  DELETE FROM Bids WHERE bid_id = p_bid_id;
END;
$$;

CREATE OR REPLACE FUNCTION accept_bid(p_bid_id INTEGER, p_actor INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_id INTEGER;
  v_client INTEGER;
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM Users WHERE user_id = p_actor;
  IF v_role IS DISTINCT FROM 'client' THEN
    RAISE EXCEPTION 'Only clients can accept bids';
  END IF;
  SELECT b.job_id, j.client_id INTO v_job_id, v_client
  FROM Bids b
  JOIN Jobs j ON j.job_id = b.job_id
  WHERE b.bid_id = p_bid_id AND b.status = 'pending';
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Bid is not pending';
  END IF;
  IF v_client <> p_actor THEN
    RAISE EXCEPTION 'Only the job owner can accept this bid';
  END IF;
  PERFORM set_config('app.user_id', p_actor::TEXT, true);
  UPDATE Bids
  SET status = 'rejected'
  WHERE job_id = v_job_id AND status = 'pending' AND bid_id <> p_bid_id;
  UPDATE Bids
  SET status = 'accepted'
  WHERE bid_id = p_bid_id AND status = 'pending';
  UPDATE Jobs
  SET status = 'in progress'
  WHERE job_id = v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION reject_bid(p_bid_id INTEGER, p_actor INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_client INTEGER;
  v_role TEXT;
  v_updated INTEGER;
BEGIN
  SELECT role INTO v_role FROM Users WHERE user_id = p_actor;
  IF v_role IS DISTINCT FROM 'client' THEN
    RAISE EXCEPTION 'Only clients can reject bids';
  END IF;
  SELECT j.client_id INTO v_client
  FROM Bids b
  JOIN Jobs j ON j.job_id = b.job_id
  WHERE b.bid_id = p_bid_id AND b.status = 'pending';
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Bid is not pending';
  END IF;
  IF v_client <> p_actor THEN
    RAISE EXCEPTION 'Only the job owner can reject this bid';
  END IF;
  PERFORM set_config('app.user_id', p_actor::TEXT, true);
  UPDATE Bids
  SET status = 'rejected'
  WHERE bid_id = p_bid_id AND status = 'pending';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Bid is not pending';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION complete_job(p_job_id INTEGER, p_actor INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_client INTEGER;
  v_status TEXT;
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM Users WHERE user_id = p_actor;
  IF v_role IS DISTINCT FROM 'client' THEN
    RAISE EXCEPTION 'Only clients can complete jobs';
  END IF;
  SELECT client_id, status INTO v_client, v_status
  FROM Jobs WHERE job_id = p_job_id;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  IF v_client <> p_actor THEN
    RAISE EXCEPTION 'Only the job owner can complete this job';
  END IF;
  IF v_status <> 'in progress' THEN
    RAISE EXCEPTION 'Only in-progress jobs can be completed';
  END IF;
  PERFORM set_config('app.user_id', p_actor::TEXT, true);
  UPDATE Jobs
  SET status = 'completed'
  WHERE job_id = p_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION complete_job_with_feedback(
  p_job_id INTEGER,
  p_from_user INTEGER,
  p_to_user INTEGER,
  p_rating NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_client INTEGER;
  v_status TEXT;
  v_role TEXT;
  v_accepted INTEGER;
BEGIN
  SELECT role INTO v_role FROM Users WHERE user_id = p_from_user;
  IF v_role IS DISTINCT FROM 'client' THEN
    RAISE EXCEPTION 'Only clients can give feedback';
  END IF;
  SELECT client_id, status INTO v_client, v_status
  FROM Jobs WHERE job_id = p_job_id;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  IF v_client <> p_from_user THEN
    RAISE EXCEPTION 'Only the job owner can give feedback';
  END IF;
  SELECT freelancer_id INTO v_accepted
  FROM Bids
  WHERE job_id = p_job_id AND status = 'accepted'
  LIMIT 1;
  IF v_accepted IS NULL OR v_accepted <> p_to_user THEN
    RAISE EXCEPTION 'Feedback must go to the accepted freelancer';
  END IF;
  PERFORM set_config('app.user_id', p_from_user::TEXT, true);
  IF v_status <> 'completed' THEN
    UPDATE Jobs
    SET status = 'completed'
    WHERE job_id = p_job_id;
  END IF;
  INSERT INTO Feedback (job_id, from_user_id, to_user_id, rating)
  VALUES (p_job_id, p_from_user, p_to_user, p_rating)
  ON CONFLICT (job_id, from_user_id) DO UPDATE
  SET rating = EXCLUDED.rating, to_user_id = EXCLUDED.to_user_id;
END;
$$;
