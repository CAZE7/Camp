import { Pool } from 'pg';

// Fallback to dummy values to prevent crashes in the browser or build when DB env vars aren't set
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/db',
});

export default pool;
