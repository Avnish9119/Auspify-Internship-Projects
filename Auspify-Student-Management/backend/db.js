const mysql = require("mysql2");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

// Local development: load backend/.env. On Render, dashboard variables take precedence.
dotenv.config({ path: path.join(__dirname, ".env") });

const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error("Missing database environment variables:", missing.join(", "));
}

const caPath = path.join(__dirname, "ca.pem");
const ssl = fs.existsSync(caPath)
  ? { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true }
  : undefined;

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true
});

db.getConnection((error, connection) => {
  if (error) {
    console.error("MySQL connection check failed:", error.message);
    return;
  }
  console.log("MySQL connection pool is ready.");
  connection.release();
});

module.exports = db;
