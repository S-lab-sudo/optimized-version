import { createClient, type Client } from "@libsql/client/http";

let _db: Client | null = null;

export const getDb = () => {
  if (_db) return _db;

  const rawUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!rawUrl || !authToken) {
    console.error("CRITICAL: Missing Turso Environment Variables");
    throw new Error("Database configuration is missing.");
  }

  // ROOT FIX: Cloudflare Edge requires https:// for fetch. 
  // libsql:// causes certain SDK versions to try to use sockets/XHR.
  const url = rawUrl.replace("libsql://", "https://");

  _db = createClient({
    url: url,
    authToken: authToken === 'undefined' ? undefined : authToken,
  });

  return _db;
};

// Exporting a proxy or just the getter is more robust for Edge
export const db = {
  execute: (stmt: Parameters<Client["execute"]>[0]) => getDb().execute(stmt),
};
