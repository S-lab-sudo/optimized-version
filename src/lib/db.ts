import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error("Missing Turso environment variables");
}

export const db = createClient({
  url: url.startsWith('file:') ? url : url,
  authToken: authToken === 'undefined' ? undefined : authToken,
});
