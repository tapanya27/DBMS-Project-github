"use server";

import { requireClerkEmail, requireDbUser } from "@/lib/auth-user";
import { getSql } from "@/lib/db";

export async function getJobs() {
  const sql = getSql();
  return sql`
    SELECT
      j.job_id,
      j.title,
      j.description,
      j.status,
      j.budget,
      j.deadline,
      j.client_id,
      u.name AS client_name,
      COALESCE(ARRAY_AGG(s.skill_name) FILTER (WHERE s.skill_name IS NOT NULL), '{}') AS skills_required
    FROM Jobs j
    JOIN Users u ON j.client_id = u.user_id
    LEFT JOIN JobSkill js ON j.job_id = js.job_id
    LEFT JOIN Skill s ON js.skill_id = s.skill_id
    GROUP BY j.job_id, u.name
    ORDER BY j.job_id
  `;
}

export async function createUser(
  firstName: string,
  lastName: string,
  _email: string,
  skills: string[],
  jobRole: string
) {
  const { email } = await requireClerkEmail();
  const sql = getSql();
  const fullName = `${firstName} ${lastName}`.trim();
  const role = jobRole === "freelancer" ? "freelancer" : "client";
  const cleanSkills = (Array.isArray(skills) ? skills : []).filter(
    (skill): skill is string => typeof skill === "string" && skill.length > 0
  );

  try {
    const userResponse = await sql`
      INSERT INTO Users (name, email, role, rating)
      VALUES (${fullName}, ${email}, ${role}, 0.0)
      ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name, role = EXCLUDED.role
      RETURNING user_id
    `;
    if (!userResponse?.[0]) {
      throw new Error("Failed to insert user");
    }
    const userId = userResponse[0].user_id as number;
    await sql`SELECT replace_user_skills(${userId}, ${cleanSkills})`;
    return { userId, fullName, email, jobRole: role, skills: cleanSkills };
  } catch (error) {
    console.error("Error in createUser:", error);
    throw error;
  }
}

export async function getJobById(jobId: number) {
  await requireClerkEmail();
  const sql = getSql();
  return sql`
    SELECT
      Bids.bid_id,
      Bids.freelancer_id,
      Users.name AS freelancer_name,
      Bids.bid_amount,
      Bids.status,
      Bids.created_at
    FROM Bids
    JOIN Users ON Bids.freelancer_id = Users.user_id
    WHERE Bids.job_id = ${jobId}
  `;
}

export async function getUserDetails(email?: string) {
  const { email: clerkEmail } = await requireClerkEmail();
  if (email && email !== clerkEmail) {
    throw new Error("Unauthorized");
  }
  const sql = getSql();
  return sql`SELECT * FROM Users WHERE email = ${clerkEmail}`;
}

export async function createBid(jobId: number, _freelancerId: number, bidAmount: number) {
  const me = await requireDbUser();
  const sql = getSql();
  await sql`SELECT create_bid(${jobId}, ${me.user_id}, ${bidAmount})`;
  return { ok: true };
}

export async function deleteBid(bidId: number) {
  const me = await requireDbUser();
  const sql = getSql();
  await sql`SELECT delete_bid(${bidId}, ${me.user_id})`;
  return { ok: true };
}

export async function updateBidAmount(bidId: number, amount: number) {
  const me = await requireDbUser();
  const sql = getSql();
  await sql`SELECT update_bid_amount(${bidId}, ${me.user_id}, ${amount})`;
  return { ok: true };
}

export async function getUserWithSkills(userId: number) {
  const me = await requireDbUser();
  if (Number(me.user_id) !== Number(userId)) {
    throw new Error("Unauthorized");
  }
  const sql = getSql();
  return sql`
    SELECT
      Users.user_id,
      Users.name,
      Users.email,
      Users.role,
      Users.rating,
      Users.created_at,
      COALESCE(ARRAY_AGG(Skill.skill_name) FILTER (WHERE Skill.skill_name IS NOT NULL), '{}') AS skills
    FROM Users
    LEFT JOIN UserSkill ON Users.user_id = UserSkill.user_id
    LEFT JOIN Skill ON UserSkill.skill_id = Skill.skill_id
    WHERE Users.user_id = ${userId}
    GROUP BY Users.user_id
  `;
}

export async function createJob(
  title: string,
  description: string,
  budget: number,
  deadline: Date,
  _clientId: number,
  skills: string[]
) {
  const me = await requireDbUser();
  if (me.role !== "client") {
    throw new Error("Only clients can post jobs. Switch role on Profile.");
  }
  const sql = getSql();
  const cleanSkills = (Array.isArray(skills) ? skills : []).filter(
    (skill): skill is string => typeof skill === "string" && skill.length > 0
  );
  try {
    return await sql`
      SELECT post_job(
        ${title},
        ${description},
        ${budget},
        ${deadline},
        ${me.user_id},
        ${cleanSkills}
      ) AS job_id
    `;
  } catch (error: any) {
    throw new Error(error?.message || "Failed to post job");
  }
}

export async function getAppliedJobs(userId: number) {
  const me = await requireDbUser();
  if (Number(me.user_id) !== Number(userId)) {
    throw new Error("Unauthorized");
  }
  const sql = getSql();
  return sql`
    SELECT
      j.job_id,
      j.title,
      j.description,
      j.status AS job_status,
      j.budget,
      j.deadline,
      b.bid_amount,
      b.status AS bid_status
    FROM Jobs j
    JOIN Bids b ON j.job_id = b.job_id
    WHERE b.freelancer_id = ${me.user_id}
  `;
}

export async function getUserPostedJobs(userId: number) {
  const me = await requireDbUser();
  if (Number(me.user_id) !== Number(userId)) {
    throw new Error("Unauthorized");
  }
  const sql = getSql();
  return sql`
    SELECT
      j.job_id,
      j.title,
      j.description,
      j.budget,
      j.deadline,
      j.status AS job_status,
      json_agg(
        json_build_object(
          'bid_id', b.bid_id,
          'freelancer_id', b.freelancer_id,
          'freelancer_name', u.name,
          'bid_amount', b.bid_amount,
          'status', b.status
        )
      ) AS bids
    FROM Jobs j
    LEFT JOIN Bids b ON j.job_id = b.job_id
    LEFT JOIN Users u ON b.freelancer_id = u.user_id
    WHERE j.client_id = ${me.user_id}
    GROUP BY j.job_id
  `;
}

export async function updateUserDetails({
  userId,
  name,
  skills,
  role,
}: {
  userId: number;
  name: string;
  skills: string[];
  role: string;
}) {
  const me = await requireDbUser();
  if (Number(me.user_id) !== Number(userId)) {
    throw new Error("Unauthorized");
  }
  const sql = getSql();
  const cleanSkills = (Array.isArray(skills) ? skills : []).filter(
    (skill): skill is string => typeof skill === "string" && skill.length > 0
  );
  const cleanRole = role === "freelancer" ? "freelancer" : "client";
  try {
    await sql`
      UPDATE Users
      SET name = ${name}, role = ${cleanRole}
      WHERE user_id = ${me.user_id}
    `;
    await sql`SELECT replace_user_skills(${me.user_id}, ${cleanSkills})`;
    return { ok: true };
  } catch (error) {
    console.error("Error in updateUserDetails:", error);
    throw error;
  }
}

export async function rejectBid(bidId: number, _actorId?: number) {
  const me = await requireDbUser();
  const sql = getSql();
  await sql`SELECT reject_bid(${bidId}, ${me.user_id})`;
  return { ok: true };
}

export async function acceptBid(bidId: number, _actorId?: number) {
  const me = await requireDbUser();
  const sql = getSql();
  await sql`SELECT accept_bid(${bidId}, ${me.user_id})`;
  return { ok: true };
}

export async function completeJob(jobId: number, _actorId?: number) {
  const me = await requireDbUser();
  const sql = getSql();
  await sql`SELECT complete_job(${jobId}, ${me.user_id})`;
  return { ok: true };
}

export async function giveFeedback(
  jobId: number,
  _fromUserId: number,
  toUserId: number,
  rating: number
) {
  const me = await requireDbUser();
  const sql = getSql();
  await sql`SELECT complete_job_with_feedback(${jobId}, ${me.user_id}, ${toUserId}, ${rating})`;
  return { ok: true };
}

export async function getReports() {
  await requireClerkEmail();
  const sql = getSql();
  const [openJobs, bidVsBudget, freelancerRank, topClients, jobsWithoutBids, monthly, audit] =
    await Promise.all([
      sql`SELECT job_id, title, budget::text, client_name FROM open_jobs ORDER BY job_id`,
      sql`SELECT job_id, title, budget::text, average_bid::text, difference::text FROM bid_vs_budget`,
      sql`SELECT user_id, name, rating::text, accepted_jobs FROM freelancer_rank`,
      sql`SELECT user_id, name, completed_jobs FROM top_clients`,
      sql`SELECT job_id, title, budget::text, client_name FROM jobs_without_bids`,
      sql`SELECT month, jobs_posted, jobs_completed FROM monthly_job_counts`,
      sql`SELECT audit_id, table_name, record_id, old_status, new_status, changed_at::text, changed_by FROM StatusAudit ORDER BY audit_id DESC LIMIT 20`,
    ]);
  return { openJobs, bidVsBudget, freelancerRank, topClients, jobsWithoutBids, monthly, audit };
}

export async function getAllFeedback() {
  const me = await requireDbUser();
  const sql = getSql();
  return sql`
    SELECT *
    FROM Feedback
    WHERE from_user_id = ${me.user_id} OR to_user_id = ${me.user_id}
  `;
}
