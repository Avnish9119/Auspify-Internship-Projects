const db = require("./db");

db.query("SHOW TABLES", (err, results) => {
  if (err) {
    console.log("Database Error:", err.message);
  } else {
    console.log("Database Tables:");
    console.table(results);
  }
  db.end();
});