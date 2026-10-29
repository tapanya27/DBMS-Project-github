import { neon } from "@neondatabase/serverless";

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

export function getSql() {
  return neon(getDatabaseUrl());
}
