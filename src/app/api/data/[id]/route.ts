import { NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
}

async function queryTurso(sql: string, args: (string | number)[] = []) {
  let rawUrl: string | undefined;
  let token: string | undefined;

  try {
    const ctx = getRequestContext();
    const env = ctx.env as Env;
    rawUrl = env.TURSO_DATABASE_URL;
    token = env.TURSO_AUTH_TOKEN;
  } catch {
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
  
  const rows = values.map((row: (string | number | null)[]) => {
    const obj: Record<string, string | number | null> = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });

  return { rows };
}

// TIP #5: On-demand detail loading
// This endpoint fetches the full row (including heavy fields like bio, salary)
// only when the user clicks "View Details" on a specific row.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const start = performance.now();
    
    // Fetch ALL columns for detail view
    const result = await queryTurso(
      "SELECT * FROM users WHERE id = ?",
      [id]
    );

    const end = performance.now();

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: result.rows[0],
      latency: Math.round(end - start),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
