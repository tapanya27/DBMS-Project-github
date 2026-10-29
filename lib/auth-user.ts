"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { getSql } from "@/lib/db";

export type DbUser = {
  user_id: number;
  name: string;
  email: string;
  role: string;
  rating: string;
  created_at: Date;
};

export async function requireClerkEmail() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error("Signed-in user has no email");
  }
  return { userId, email, clerkUser };
}

export async function requireDbUser(): Promise<DbUser> {
  const { email } = await requireClerkEmail();
  const sql = getSql();
  const rows = await sql`
    SELECT user_id, name, email, role, rating::text, created_at
    FROM Users
    WHERE email = ${email}
  `;
  if (!rows[0]) {
    throw new Error("Finish your profile before continuing");
  }
  return rows[0] as DbUser;
}
