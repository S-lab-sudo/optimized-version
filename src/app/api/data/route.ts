import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const cursor = searchParams.get("cursor") || null;
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    const start = performance.now();
    
    // TIP #4: Cursor-based Pagination (Robustness)
    // We use the ID as a cursor to fetch the next set of results.
    // This is much faster than OFFSET for large datasets.
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

    const result = await db.execute({ sql: query, args });

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
