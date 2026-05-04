import { Pool } from 'pg';

const pool = new Pool({
  ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {})
});

export default pool;
