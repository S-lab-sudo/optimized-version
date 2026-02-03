import { NextResponse } from "next/server";

export const runtime = "edge";

// ROOT FIX: Direct HTTP calls to Turso, bypassing @libsql/client entirely.
// The SDK has bundling issues with next-on-pages. Native fetch always works.
async function queryTurso(sql: string, args: any[] = []) {
  const url = process.env.TURSO_DATABASE_URL?.replace("libsql://", "https://");
  const token = process.env.TURSO_AUTH_TOKEN;

  if (!url || !token) {
    throw new Error("Missing database configuration");
  }

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
  
  // Turso returns results in a specific format
  const result = data[0];
  if (result.error) {
    throw new Error(result.error.message);
  }

  // Convert Turso's response format to rows
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
    
    // Build query with cursor-based pagination
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
