let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  pool.query(`
    DROP TABLE IF EXISTS waitlist;
    CREATE TABLE waitlist (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      tier_level VARCHAR(50) NOT NULL,
      verified BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).then(() => {
    console.log('Database pool initialized and waitlist table recreated successfully.');
  }).catch(err => {
    console.error('Error creating waitlist table:', err);
  });
}
