let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('Database pool initialized.');
} else {
  console.log('Warning: DATABASE_URL not found. Running without active DB connection.');
}
