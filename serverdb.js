// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const authMiddleware = require("./auth");
const connectDB = require("./db");
const { User, Call } = require("./model/models");

const app = express();
app.use(cors());
app.use(express.json());

/* ============================
   DATABASE CHECK
============================ */
(async () => {
  try {
    await connectDB();
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
   REGISTER
============================ */

app.post("/api/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Validate
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // Check existing user
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Hash password
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      username,
      password_hash: password, // Will be hashed by pre-save hook
      role: role || "user"
    });

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/* ============================
   LOGIN
============================ */
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({
      token,
      user: {
        id: "6965",
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

    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(400).json({ error: "user exists" });
    }

    // Note: password will be hashed automatically by the pre-save hook
    const newUser = new User({
      username,
      password_hash: password, // Will be hashed by pre-save hook
      role: role || "employee",
    });

    await newUser.save();

    res.json({ ok: true, user: { id: newUser._id, username: newUser.username, role: newUser.role } });
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

      // Validate employee exists
      const employee = await User.findById(employee_id);
      if (!employee) {
        return res.status(404).json({ error: "employee not found" });
      }

      const newCall = new Call({
        employee_id,
        phone_number: phone_number || "UNKNOWN",
        call_type: call_type || "outgoing",
        start_ms,
        end_ms: end_ms || null,
        duration_seconds: duration_seconds || 0,
        audio_file: req.file.filename,
      });

      await newCall.save();

      res.json({
        ok: true,
        call: {
          id: newCall._id,
          audio_file: newCall.audio_file,
          uploaded_at: newCall.uploaded_at
        }
      });
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      res.status(500).json({ error: "upload failed" });
    }
  }
);

/* ============================
   UPLOAD LOCATION
============================ */
app.post("/api/location/upload", authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, timestamp } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: "latitude & longitude required" });
    }

    const location = await Location.create({
      employee_id: req.user.id, // 🔐 from JWT
      latitude,
      longitude,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    res.status(201).json({
      ok: true,
      location_id: location._id,
    });
  } catch (err) {
    console.error("LOCATION UPLOAD ERROR:", err);
    res.status(500).json({ error: "location upload failed" });
  }
});


/* ============================
   FETCH CALLS
============================ */
app.get("/api/calls", authMiddleware, async (req, res) => {
  try {
    let calls;

    if (req.user.role === "admin") {
      calls = await Call.find()
        .populate('employee_id', 'username role')
        .sort({ uploaded_at: -1 });
    } else {
      calls = await Call.find({ employee_id: req.user.id })
        .populate('employee_id', 'username role')
        .sort({ uploaded_at: -1 });
    }

    // Transform the data to match frontend expectations
    const transformedCalls = calls.map(call => ({
      id: call._id,
      employee_id: call.employee_id._id,
      employee_name: call.employee_id.username,
      phone_number: call.phone_number,
      call_type: call.call_type,
      start_ms: call.start_ms,
      end_ms: call.end_ms,
      duration_seconds: call.duration_seconds,
      audio_file: call.audio_file,
      uploaded_at: call.uploaded_at,
    }));

    res.json({ ok: true, calls: transformedCalls });
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
    const total = await Call.countDocuments();
    const outgoing = await Call.countDocuments({ call_type: 'outgoing' });

    // Use MongoDB aggregation for sum
    const durationResult = await Call.aggregate([
      {
        $group: {
          _id: null,
          totalDuration: { $sum: "$duration_seconds" }
        }
      }
    ]);

    const totalDuration = durationResult.length > 0 ? durationResult[0].totalDuration : 0;

    res.json({
      total,
      outgoing,
      totalDuration: totalDuration / 60, // Convert to minutes
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

    const call = await Call.findOne({ audio_file: name })
      .populate('employee_id', '_id');

    if (!call) return res.sendStatus(404);

    const owner = call.employee_id._id.toString();
    if (req.user.role !== "admin" && req.user.id !== owner) {
      return res.sendStatus(403);
    }

    const file = path.join(UPLOAD_DIR, name);
    if (!fs.existsSync(file)) return res.sendStatus(404);

    res.sendFile(file);
  } catch (err) {
    console.error("AUDIO ERROR:", err);
    res.sendStatus(500);
  }
});

/* ============================
   ADDITIONAL HELPER ROUTES
============================ */

// Get all users (Admin only)
app.get("/api/users", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }

  try {
    const users = await User.find({}, { password_hash: 0 }); // Exclude password
    res.json({ ok: true, users });
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    res.status(500).json({ error: "fetch failed" });
  }
});

// Get specific call by ID
app.get("/api/calls/:id", authMiddleware, async (req, res) => {
  try {
    const call = await Call.findById(req.params.id)
      .populate('employee_id', 'username role');

    if (!call) return res.status(404).json({ error: "call not found" });

    // Check permission
    if (req.user.role !== "admin" && req.user.id !== call.employee_id._id.toString()) {
      return res.status(403).json({ error: "forbidden" });
    }

    res.json({
      ok: true,
      call: {
        id: call._id,
        employee_id: call.employee_id._id,
        employee_name: call.employee_id.username,
        phone_number: call.phone_number,
        call_type: call.call_type,
        start_ms: call.start_ms,
        end_ms: call.end_ms,
        duration_seconds: call.duration_seconds,
        audio_file: call.audio_file,
        uploaded_at: call.uploaded_at,
      }
    });
  } catch (err) {
    console.error("GET CALL ERROR:", err);
    res.status(500).json({ error: "fetch failed" });
  }
});

/* ============================
   START SERVER
============================ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
