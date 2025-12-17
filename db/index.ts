import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Handle pool errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

export const db = drizzle({ client: pool, schema });
export { pool };
