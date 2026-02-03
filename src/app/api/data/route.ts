import { NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

// Extend CloudflareEnv to include our custom vars
interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
}

async function queryTurso(sql: string, args: any[] = []) {
  let rawUrl: string | undefined;
  let token: string | undefined;

  // Try Cloudflare bindings first
  try {
    const ctx = getRequestContext();
    const env = ctx.env as Env;
    rawUrl = env.TURSO_DATABASE_URL;
    token = env.TURSO_AUTH_TOKEN;
  } catch {
    // Fallback to process.env for local development
    rawUrl = process.env.TURSO_DATABASE_URL;
    token = process.env.TURSO_AUTH_TOKEN;
  }

  if (!rawUrl || !token) {
    throw new Error("Missing database configuration");
  }

  const url = rawUrl.replace("libsql://", "https://");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      statements: [{ q: sql, params: args }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Turso error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  const result = data[0];
  
  if (result.error) {
    throw new Error(result.error.message);
  }

  const columns = result.results?.columns || [];
  const values = result.results?.rows || [];
  
  const rows = values.map((row: any[]) => {
    const obj: Record<string, any> = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });

  return { rows };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const cursor = searchParams.get("cursor") || null;
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    const start = performance.now();
    
    let query = search 
      ? "SELECT * FROM users WHERE (name LIKE ? OR email LIKE ?)" 
      : "SELECT * FROM users";
    
    const args: any[] = search ? [`%${search}%`, `%${search}%`] : [];

    if (cursor) {
      query += search ? " AND id > ?" : " WHERE id > ?";
      args.push(cursor);
    }

    query += " ORDER BY id LIMIT ?";
    args.push(limit);

    const result = await queryTurso(query, args);

    const end = performance.now();
    const rows = result.rows;
    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

    return NextResponse.json({
      data: rows,
      latency: Math.round(end - start),
      count: rows.length,
      nextCursor
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
