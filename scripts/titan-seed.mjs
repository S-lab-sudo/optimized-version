
import "dotenv/config";
import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function titanSeed() {
  console.log("🚀 INITIATING TITAN SEEDER (Aggressive + Robust Mode)");

  // 1. Prepare Table & Schema
  console.log("🛠️ Preparing Cloud Schema...");
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    role TEXT,
    department TEXT,
    status TEXT,
    location TEXT,
    salary INTEGER,
    bio TEXT
  )`);
  
  await db.execute("CREATE INDEX IF NOT EXISTS idx_users_name ON users(name)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");

  const dataPath = path.join(process.cwd(), "public", "data.json");
  if (!fs.existsSync(dataPath)) {
    console.error("❌ No data.json found. Run JSON generation first.");
    return;
  }

  const rawData = fs.readFileSync(dataPath, "utf-8");
  const users = JSON.parse(rawData);
  const total = users.length;
  
  const BATCH_SIZE = 150; // Performance sweet spot
  const CONCURRENCY = 15; // 15 parallel streams
  const RETRIES = 3;

  const startTotal = performance.now();
  console.log(`📦 Blasting ${total.toLocaleString()} rows via ${CONCURRENCY} parallel lanes...`);

  const uploadBatch = async (batch, offset) => {
    let attempt = 0;
    while (attempt < RETRIES) {
      try {
        const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        const values = batch.flatMap(u => [
          u.id, u.name, u.email, u.role, u.department, u.status, u.location, u.salary, u.bio
        ]);
        
        await db.execute({
          sql: `INSERT OR REPLACE INTO users VALUES ${placeholders}`,
          args: values
        });
        return; // Success
      } catch (err) {
        attempt++;
        if (attempt === RETRIES) {
          console.error(`\n❌ Failed batch at ${offset} after ${RETRIES} attempts: ${err.message}`);
        } else {
          // Exponential backoff
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }
  };

  // Process in Large Parallel Chunks
  for (let i = 0; i < total; i += (BATCH_SIZE * CONCURRENCY)) {
    const lanePromises = [];
    for (let l = 0; l < CONCURRENCY; l++) {
      const offset = i + (l * BATCH_SIZE);
      if (offset < total) {
        const batch = users.slice(offset, offset + BATCH_SIZE);
        lanePromises.push(uploadBatch(batch, offset));
      }
    }

    await Promise.all(lanePromises);

    const currentProgress = Math.min(i + (BATCH_SIZE * CONCURRENCY), total);
    const percent = ((currentProgress / total) * 100).toFixed(2);
    const elapsedSec = ((performance.now() - startTotal) / 1000).toFixed(1);
    const rowsPerSec = (currentProgress / parseFloat(elapsedSec)).toFixed(0);
    
    process.stdout.write(`\r🚀 Progress: ${percent}% | Rows: ${currentProgress.toLocaleString()} | Speed: ${rowsPerSec} r/s | Time: ${elapsedSec}s`);
  }

  console.log(`\n\n🏆 TITAN SEED COMPLETE! 1 Million Rows are now LIVE in the Cloud.`);
  process.exit(0);
}

titanSeed();
