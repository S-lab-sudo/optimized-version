import { createClient, type Client } from "@libsql/client/web";

let _db: Client | null = null;

export const getDb = () => {
  if (_db) return _db;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("CRITICAL: Missing Turso Environment Variables");
    throw new Error("Database configuration is missing. Please check Cloudflare Environment Variables.");
  }

  _db = createClient({
    url: url,
    authToken: authToken === 'undefined' ? undefined : authToken,
  });

  return _db;
};

// Exporting a proxy or just the getter is more robust for Edge
export const db = {
  execute: (stmt: any) => getDb().execute(stmt),
};
