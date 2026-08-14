// Add this inside your startup table initialization block in index.js
async function initializeTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS waitlist (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Database pool initialized and all session tables verified.");
    } catch (err) {
        console.error("Error initializing database tables:", err);
    }
}
