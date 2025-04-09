import dotenv from "dotenv";
import pkg from "pg";

const { Pool } = pkg;


dotenv.config();

console.log(process.env.DATABASE_URL)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Test the connection
pool
  .connect()
  .then(() => console.log("Connected to PostgreSQL!"))
  .catch((err) => console.error("Error connecting to PostgreSQL:", err.message));

export default pool;