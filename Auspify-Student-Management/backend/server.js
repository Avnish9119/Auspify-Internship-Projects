const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5001;
app.use(express.json());
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_LIFETIME = "8h";

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("JWT_SECRET is missing or too short. Set a random secret of at least 32 characters.");
  process.exit(1);
}

app.use(cors({ origin: true }));
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "../frontend")));

function query(sql, values = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, values, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authentication required. Please log in again." });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_error) {
    return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    return next();
  };
}

app.get("/api/test", (_req, res) => res.json({ message: "Backend is running" }));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "../frontend/login.html")));

// Login supports the existing legacy password once, then upgrades it to bcrypt.
app.post("/api/login", async (req, res) => {
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const role = typeof req.body.role === "string" ? req.body.role.trim().toLowerCase() : "";

  if (!username || !password || !role) {
    return res.status(400).json({ success: false, message: "Username, password and role are required." });
  }

  try {
    const users = await query(
      "SELECT id, username, password, role FROM users WHERE username = ? AND role = ? LIMIT 1",
      [username, role]
    );
    if (!users.length) {
      return res.status(401).json({ success: false, message: "Invalid username, password or role." });
    }

    const user = users[0];
    const storedPassword = String(user.password || "");
    const isBcrypt = /^\$2[aby]\$/.test(storedPassword);
    const validPassword = isBcrypt
      ? await bcrypt.compare(password, storedPassword)
      : password === storedPassword;

    if (!validPassword) {
      return res.status(401).json({ success: false, message: "Invalid username, password or role." });
    }

    // Upgrade legacy directly-comparable passwords after a successful login.
    if (!isBcrypt) {
      const newHash = await bcrypt.hash(password, 12);
      await query("UPDATE users SET password = ? WHERE id = ?", [newHash, user.id]);
    }

    const safeUser = { id: user.id, username: user.username, role: user.role };
    const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: TOKEN_LIFETIME });
    return res.json({ success: true, message: "Login successful", user: safeUser, token });
  } catch (error) {
    console.error("LOGIN ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Unable to sign in right now." });
  }
});

app.get("/api/students", authenticate, allowRoles("admin", "teacher"), async (_req, res) => {
  try {
    const rows = await query("SELECT id, name, roll_no, email, phone, branch, semester FROM students WHERE is_deleted = 0 ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    console.error("FETCH STUDENTS ERROR:", error.message);
    res.status(500).json({ error: "Database error while fetching students." });
  }
});

app.post("/api/students", authenticate, allowRoles("admin"), async (req, res) => {
  const { name, roll_no, email, phone, branch, semester } = req.body;
  if (typeof name !== "string" || !name.trim() || roll_no == null || !String(roll_no).trim()) {
    return res.status(400).json({ error: "Name and roll number are required." });
  }
  const sem = semester === "" || semester == null ? null : Number(semester);
  if (sem !== null && (!Number.isInteger(sem) || sem < 1 || sem > 20)) {
    return res.status(400).json({ error: "Semester must be a valid number." });
  }
  try {
    const result = await query(
      "INSERT INTO students (name, roll_no, email, phone, branch, semester) VALUES (?, ?, ?, ?, ?, ?)",
      [name.trim(), String(roll_no).trim(), email || null, phone || null, branch || null, sem]
    );
    res.status(201).json({ message: "Student added successfully", id: result.insertId });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "This roll number already exists." });
    console.error("ADD STUDENT ERROR:", error.message);
    res.status(500).json({ error: "Database error while adding student." });
  }
});

app.put("/api/students/:id", authenticate, allowRoles("admin"), async (req, res) => {
  const { id } = req.params;
  const { name, roll_no, email, phone, branch, semester } = req.body;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: "Invalid student ID." });
  if (typeof name !== "string" || !name.trim() || roll_no == null || !String(roll_no).trim()) {
    return res.status(400).json({ error: "Name and roll number are required." });
  }
  const sem = semester === "" || semester == null ? null : Number(semester);
  if (sem !== null && (!Number.isInteger(sem) || sem < 1 || sem > 20)) {
    return res.status(400).json({ error: "Semester must be a valid number." });
  }
  try {
    const result = await query(
      "UPDATE students SET name = ?, roll_no = ?, email = ?, phone = ?, branch = ?, semester = ? WHERE id = ? AND is_deleted = 0",
      [name.trim(), String(roll_no).trim(), email || null, phone || null, branch || null, sem, id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Active student not found." });
    res.json({ message: "Student updated successfully." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "This roll number already exists." });
    console.error("UPDATE STUDENT ERROR:", error.message);
    res.status(500).json({ error: "Database error while updating student." });
  }
});

app.delete("/api/students/:id", authenticate, allowRoles("admin"), async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: "Invalid student ID." });
  try {
    const result = await query("UPDATE students SET is_deleted = 1 WHERE id = ? AND is_deleted = 0", [id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Active student not found." });
    res.json({ message: "Student moved to Recycle Bin successfully." });
  } catch (error) {
    console.error("DELETE STUDENT ERROR:", error.message);
    res.status(500).json({ error: "Database error while deleting student." });
  }
});

app.get("/api/students/recycle-bin", authenticate, allowRoles("admin"), async (_req, res) => {
  try {
    const rows = await query("SELECT id, name, roll_no, email, phone, branch, semester FROM students WHERE is_deleted = 1 ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    console.error("RECYCLE BIN ERROR:", error.message);
    res.status(500).json({ error: "Could not load Recycle Bin." });
  }
});

app.put("/api/students/:id/restore", authenticate, allowRoles("admin"), async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: "Invalid student ID." });
  try {
    const result = await query("UPDATE students SET is_deleted = 0 WHERE id = ? AND is_deleted = 1", [id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Deleted student not found." });
    res.json({ message: "Student restored successfully." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Cannot restore: this roll number is already in use." });
    console.error("RESTORE STUDENT ERROR:", error.message);
    res.status(500).json({ error: "Database error while restoring student." });
  }
});

app.delete("/api/students/:id/permanent", authenticate, allowRoles("admin"), async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: "Invalid student ID." });
  try {
    const result = await query("DELETE FROM students WHERE id = ? AND is_deleted = 1", [id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Deleted student not found." });
    res.json({ message: "Student permanently deleted." });
  } catch (error) {
    console.error("PERMANENT DELETE ERROR:", error.message);
    res.status(500).json({ error: "Database error while permanently deleting student." });
  }
});
// ================= Aapp.listenTTENDANCE APIs =================

// Get attendance for a particular date
app.get("/api/attendance", authenticate, allowRoles("admin", "teacher"), async (req, res) => {
  const date = req.query.date;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Valid date is required (YYYY-MM-DD)." });
  }

  try {
    const rows = await query(
      `SELECT s.id AS student_id, s.name, s.roll_no,
              COALESCE(a.status, 'Not Marked') AS status
       FROM students s
       LEFT JOIN attendance a
         ON a.student_id = s.id AND a.attendance_date = ?
       WHERE s.is_deleted = 0
       ORDER BY s.name`,
      [date]
    );

    res.json(rows);
  } catch (error) {
    console.error("FETCH ATTENDANCE ERROR:", error.message);
    res.status(500).json({ error: "Could not fetch attendance." });
  }
});

// Mark or update attendance
app.post("/api/attendance", authenticate, allowRoles("admin", "teacher"), async (req, res) => {
  const { student_id, attendance_date, status } = req.body;

  if (!Number.isInteger(Number(student_id)) || Number(student_id) < 1) {
    return res.status(400).json({ error: "Valid student ID is required." });
  }

  if (!attendance_date || !/^\d{4}-\d{2}-\d{2}$/.test(attendance_date)) {
    return res.status(400).json({ error: "Valid attendance date is required." });
  }

  if (!["Present", "Absent", "Late"].includes(status)) {
    return res.status(400).json({ error: "Status must be Present, Absent or Late." });
  }

  try {
    const students = await query(
      "SELECT id FROM students WHERE id = ? AND is_deleted = 0",
      [student_id]
    );

    if (!students.length) {
      return res.status(404).json({ error: "Active student not found." });
    }

    await query(
      `INSERT INTO attendance
       (student_id, attendance_date, status, marked_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       status = VALUES(status), marked_by = VALUES(marked_by)`,
      [student_id, attendance_date, status, req.user.id]
    );

    res.json({ message: "Attendance saved successfully." });
  } catch (error) {
    console.error("SAVE ATTENDANCE ERROR:", error.message);
    res.status(500).json({ error: "Could not save attendance." });
  }
});


// ================= MARKS APIs =================

// Get marks
app.get("/api/marks", authenticate, allowRoles("admin", "teacher"), async (req, res) => {
  try {
    let sql = `
      SELECT m.id, m.student_id, s.name, s.roll_no,
             m.subject, m.exam_name, m.max_marks, m.marks_obtained
      FROM marks m
      JOIN students s ON s.id = m.student_id
      WHERE s.is_deleted = 0
    `;

    const values = [];

    if (req.query.student_id) {
      if (!/^\d+$/.test(req.query.student_id)) {
        return res.status(400).json({ error: "Invalid student ID." });
      }

      sql += " AND m.student_id = ?";
      values.push(req.query.student_id);
    }

    sql += " ORDER BY m.id DESC";

    const rows = await query(sql, values);
    res.json(rows);
  } catch (error) {
    console.error("FETCH MARKS ERROR:", error.message);
    res.status(500).json({ error: "Could not fetch marks." });
  }
});

// Add marks
app.post("/api/marks", authenticate, allowRoles("admin", "teacher"), async (req, res) => {
  const {
    student_id,
    subject,
    exam_name,
    max_marks,
    marks_obtained
  } = req.body;

  const max = Number(max_marks);
  const obtained = Number(marks_obtained);

  if (!Number.isInteger(Number(student_id)) || Number(student_id) < 1) {
    return res.status(400).json({ error: "Valid student ID is required." });
  }

  if (typeof subject !== "string" || !subject.trim() ||
      typeof exam_name !== "string" || !exam_name.trim()) {
    return res.status(400).json({ error: "Subject and exam name are required." });
  }

  if (
    max_marks === "" || marks_obtained === "" ||
    !Number.isFinite(max) || !Number.isFinite(obtained) ||
    max <= 0 || obtained < 0 || obtained > max
  ) {
    return res.status(400).json({ error: "Enter valid marks. Obtained marks cannot exceed maximum marks." });
  }

  try {
    const students = await query(
      "SELECT id FROM students WHERE id = ? AND is_deleted = 0",
      [student_id]
    );

    if (!students.length) {
      return res.status(404).json({ error: "Active student not found." });
    }

    const result = await query(
      `INSERT INTO marks
       (student_id, subject, exam_name, max_marks, marks_obtained, entered_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        student_id,
        subject.trim(),
        exam_name.trim(),
        max,
        obtained,
        req.user.id
      ]
    );

    res.status(201).json({
      message: "Marks added successfully.",
      id: result.insertId
    });
  } catch (error) {
    console.error("ADD MARKS ERROR:", error.message);
    res.status(500).json({ error: "Could not save marks." });
  }
});
// Student can view only their own dashboard data

// Student can view only their own dashboard data
app.get("/api/student/dashboard", authenticate, allowRoles("student"), async (req, res) => {
  try {
    const users = await query(
      "SELECT student_id FROM users WHERE id = ? AND role = 'student' LIMIT 1",
      [req.user.id]
    );

    if (!users.length || !users[0].student_id) {
      return res.status(404).json({ error: "Student record is not linked." });
    }

    const studentId = users[0].student_id;

    const students = await query(
      "SELECT id, name, roll_no, email, phone, branch, semester FROM students WHERE id = ? AND is_deleted = 0",
      [studentId]
    );

    if (!students.length) {
      return res.status(404).json({ error: "Student profile not found." });
    }

    const attendance = await query(
      "SELECT attendance_date, status FROM attendance WHERE student_id = ? ORDER BY attendance_date DESC",
      [studentId]
    );

    const marks = await query(
      "SELECT subject, exam_name, max_marks, marks_obtained FROM marks WHERE student_id = ? ORDER BY id DESC",
      [studentId]
    );

    return res.json({
      student: students[0],
      attendance,
      marks
    });
  } catch (error) {
    console.error("STUDENT DASHBOARD ERROR:", error.message);
    return res.status(500).json({ error: "Unable to load student dashboard." });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
