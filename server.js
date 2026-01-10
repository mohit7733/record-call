// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const authMiddleware = require("./auth");
const connectDB = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

/* ============================
   DATABASE CHECK
============================ */
(async () => {
  console.log(process.env.MONGODB_URI);
  try {
    const res = await connectDB();
    console.log("✅ Database connected");
  } catch (err) {
    console.error("❌ Database connection failed:", err);
  }
})();

/* ============================
   HEALTH CHECK
============================ */
app.get("/", (_, res) => {
  res.send("PropShop CRM Backend is running");
});

/* ============================
   UPLOAD SETUP
============================ */
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => cb(null, Date.now() + "_" + file.originalname),
});
const upload = multer({ storage });

/* ============================
   LOGIN
============================ */
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await connectDB.query(
      "SELECT id, username, password_hash, role FROM public.users WHERE username = $1",
      [username]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "login failed" });
  }
});

/* ============================
   CREATE USER (ADMIN)
============================ */
app.post("/api/users", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { username, password, role } = req.body;

    const exists = await pool.query(
      "SELECT id FROM public.users WHERE username = $1",
      [username]
    );

    if (exists.rows.length) {
      return res.status(400).json({ error: "user exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO public.users (username, password_hash, role) VALUES ($1,$2,$3)",
      [username, hash, role || "employee"]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);
    res.status(500).json({ error: "user create failed" });
  }
});

/* ============================
   UPLOAD CALL
============================ */
app.post(
  "/api/calls/upload",
  authMiddleware,
  upload.single("audio"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "audio file missing" });
      }

      const meta = JSON.parse(req.body.metadata || "{}");
      const {
        employee_id,
        phone_number,
        call_type,
        start_ms,
        end_ms,
        duration_seconds,
      } = meta;

      if (!employee_id || !start_ms) {
        return res.status(400).json({ error: "invalid metadata" });
      }

      await pool.query(
        `INSERT INTO public.calls
         (employee_id, phone_number, call_type, start_ms, end_ms, duration_seconds, audio_file)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          employee_id,
          phone_number || "UNKNOWN",
          call_type || "outgoing",
          start_ms,
          end_ms || null,
          duration_seconds || 0,
          req.file.filename,
        ]
      );

      res.json({ ok: true });
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      res.status(500).json({ error: "upload failed" });
    }
  }
);

/* ============================
   FETCH CALLS
============================ */
app.get("/api/calls", authMiddleware, async (req, res) => {
  try {
    const result =
      req.user.role === "admin"
        ? await pool.query(
          "SELECT * FROM public.calls ORDER BY uploaded_at DESC"
        )
        : await pool.query(
          "SELECT * FROM public.calls WHERE employee_id = $1 ORDER BY uploaded_at DESC",
          [req.user.id]
        );

    res.json({ ok: true, calls: result.rows });
  } catch (err) {
    console.error("CALL FETCH ERROR:", err);
    res.status(500).json({ error: "fetch failed" });
  }
});

/* ============================
   SUMMARY (ADMIN)
============================ */
app.get("/api/summary", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }

  try {
    const total = await pool.query("SELECT COUNT(*) FROM public.calls");
    const outgoing = await pool.query(
      "SELECT COUNT(*) FROM public.calls WHERE call_type = 'outgoing'"
    );
    const duration = await pool.query(
      "SELECT COALESCE(SUM(duration_seconds),0) AS total FROM public.calls"
    );

    res.json({
      total: Number(total.rows[0].count),
      outgoing: Number(outgoing.rows[0].count),
      totalDuration: Number(duration.rows[0].total) / 60,
    });
  } catch (err) {
    console.error("SUMMARY ERROR:", err);
    res.status(500).json({ error: "summary failed" });
  }
});

/* ============================
   SERVE AUDIO FILE
============================ */
app.get("/files/:name", authMiddleware, async (req, res) => {
  try {
    const { name } = req.params;

    const result = await pool.query(
      "SELECT employee_id FROM public.calls WHERE audio_file = $1",
      [name]
    );

    if (!result.rows.length) return res.sendStatus(404);

    const owner = result.rows[0].employee_id;
    if (req.user.role !== "admin" && req.user.id !== owner)
      return res.sendStatus(403);

    const file = path.join(UPLOAD_DIR, name);
    if (!fs.existsSync(file)) return res.sendStatus(404);

    res.sendFile(file);
  } catch (err) {
    console.error("AUDIO ERROR:", err);
    res.sendStatus(500);
  }
});

/* ============================
   START SERVER
============================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
