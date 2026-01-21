// // server.js
// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const jwt = require("jsonwebtoken");
// const multer = require("multer");
// const fs = require("fs");
// const path = require("path");

// const authMiddleware = require("./auth");
// const connectDB = require("./db");
// const { User, Call } = require("./model/models");

// const app = express();
// app.use(cors());
// app.use(express.json());

// /* ============================
//    DATABASE CHECK
// ============================ */
// (async () => {
//   try {
//     await connectDB();
//     console.log("✅ Database connected");
//   } catch (err) {
//     console.error("❌ Database connection failed:", err);
//   }
// })();

// /* ============================
//    HEALTH CHECK
// ============================ */
// app.get("/", (_, res) => {
//   res.send("PropShop CRM Backend is running");
// });

// /* ============================
//    UPLOAD SETUP
// ============================ */
// const UPLOAD_DIR = path.join(__dirname, "uploads");
// if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// const storage = multer.diskStorage({
//   destination: (_, __, cb) => cb(null, UPLOAD_DIR),
//   filename: (_, file, cb) => cb(null, Date.now() + "_" + file.originalname),
// });
// const upload = multer({ storage });

// app.use("/uploads", express.static(UPLOAD_DIR));

// /* ============================
//    REGISTER (USERNAME + PHONE + PASSWORD)
// ============================ */

// app.post("/api/register", async (req, res) => {
//   try {
//     const { username, phone_number, password, role } = req.body;

//     // 🔴 Validate
//     if (!username || !phone_number || !password) {
//       return res.status(400).json({
//         error: "username, phone_number and password are required",
//       });
//     }

//     // 🔴 Check username
//     const existingUser = await User.findOne({ username });
//     if (existingUser) {
//       return res.status(409).json({ error: "username already exists" });
//     }

//     // 🔴 Check phone number
//     const existingPhone = await User.findOne({ phone_number });
//     if (existingPhone) {
//       return res.status(409).json({ error: "phone number already exists" });
//     }

//     // ✅ Create user (password hashed by schema hook)
//     const user = await User.create({
//       username,
//       phone_number,
//       password_hash: password,
//       role: role || "employee",
//     });

//     // 🔐 JWT
//     const token = jwt.sign(
//       { id: user._id, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: "12h" }
//     );

//     res.status(201).json({
//       ok: true,
//       message: "User registered successfully",
//       token,
//       user: {
//         id: user._id,
//         username: user.username,
//         phone_number: user.phone_number,
//         role: user.role,
//       },
//     });

//   } catch (error) {
//     console.error("REGISTER ERROR:", error);
//     res.status(500).json({ error: "Registration failed" });
//   }
// });


// /* ============================
//    LOGIN (USERNAME OR PHONE)
// ============================ */
// app.post("/api/login", async (req, res) => {
//   try {
//     const { identifier, password } = req.body;

//     if (!identifier || !password) {
//       return res.status(400).json({
//         error: "identifier and password required",
//       });
//     }

//     // 🔍 Find by username OR phone number
//     const user = await User.findOne({
//       $or: [
//         { username: identifier },
//         { phone_number: identifier }
//       ]
//     });

//     if (!user) {
//       return res.status(401).json({ error: "Invalid credentials" });
//     }

//     const match = await user.comparePassword(password);
//     if (!match) {
//       return res.status(401).json({ error: "Invalid credentials" });
//     }

//     const token = jwt.sign(
//       { id: user._id, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: "12h" }
//     );

//     // ✅ SAME RESPONSE FORMAT (IMPORTANT)
//     res.json({
//       ok: true,
//       token,
//       user: {
//         id: user._id,
//         username: user.username,
//         phone_number: user.phone_number,
//         role: user.role,
//       },
//     });

//   } catch (err) {
//     console.error("LOGIN ERROR:", err);
//     res.status(500).json({ error: "login failed" });
//   }
// });


// /* ============================
//     Request OTP 
// ============================ */
// app.post("/api/auth/request-reset", async (req, res) => {
//   try {
//     const { phone_number } = req.body;

//     if (!phone_number) {
//       return res.status(400).json({ error: "phone number required" });
//     }

//     const user = await User.findOne({ phone_number });
//     if (!user) {
//       return res.status(404).json({ error: "user not found" });
//     }

//     // Generate 6-digit OTP
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();

//     user.reset_otp = otp;
//     user.reset_otp_expiry = Date.now() + 5 * 60 * 1000; // 5 minutes
//     await user.save();

//     console.log("RESET OTP:", otp); // 🔔 Replace with SMS gateway later

//     res.json({
//       ok: true,
//       message: "OTP sent to registered mobile number",
//     });

//   } catch (err) {
//     console.error("REQUEST RESET ERROR:", err);
//     res.status(500).json({ error: "failed to send OTP" });
//   }
// });


// /* ============================
//     Verify OTP 
// ============================ */

// app.post("/api/auth/reset-password", async (req, res) => {
//   try {
//     const { phone_number, otp, new_password } = req.body;

//     if (!phone_number || !otp || !new_password) {
//       return res.status(400).json({ error: "all fields required" });
//     }

//     const user = await User.findOne({
//       phone_number,
//       reset_otp: otp,
//       reset_otp_expiry: { $gt: Date.now() },
//     });

//     if (!user) {
//       return res.status(400).json({ error: "invalid or expired OTP" });
//     }

//     // 🔐 Update password (hash via pre-save hook)
//     user.password_hash = new_password;
//     user.reset_otp = null;
//     user.reset_otp_expiry = null;

//     await user.save();

//     res.json({
//       ok: true,
//       message: "Password reset successful",
//     });

//   } catch (err) {
//     console.error("RESET PASSWORD ERROR:", err);
//     res.status(500).json({ error: "password reset failed" });
//   }
// });


// /* ============================
//    CREATE USER (ADMIN)
// ============================ */
// // app.post("/api/users", authMiddleware, async (req, res) => {
// //   try {
// //     if (req.user.role !== "admin") {
// //       return res.status(403).json({ error: "forbidden" });
// //     }

// //     const { username, password, role } = req.body;

// //     const exists = await User.findOne({ username });
// //     if (exists) {
// //       return res.status(400).json({ error: "user exists" });
// //     }

// //     // Note: password will be hashed automatically by the pre-save hook
// //     const newUser = new User({
// //       username,
// //       password_hash: password, // Will be hashed by pre-save hook
// //       role: role || "employee",
// //     });

// //     await newUser.save();

// //     res.json({ ok: true, user: { id: newUser._id, username: newUser.username, role: newUser.role } });
// //   } catch (err) {
// //     console.error("CREATE USER ERROR:", err);
// //     res.status(500).json({ error: "user create failed" });
// //   }
// // });

// /* ============================
//    UPLOAD CALL
// ============================ */
// app.post("/api/upload", upload.single("audio_file"), async (req, res) => {
//   // console.log("BODY:", JSON.parse(req.body.metadata.trim() || "{}"));
//   // console.log("FILE:", req.file);

//   try {
//     if (!req.file) {
//       return res.status(400).json({ error: "audio file missing" });
//     }

//     const meta = JSON.parse(req.body.metadata.trim() || "{}");
//     console.log(meta);

//     const {
//       employee_id,
//       phone_number,
//       call_type,
//       start_ms,
//       end_ms,
//       duration_seconds,
//       location,
//     } = meta;

//     if (!employee_id) {
//       return res.status(400).json({ error: "invalid metadata" });
//     }

//     const employee = await User.findById(employee_id);
//     if (!employee) {
//       return res.status(404).json({ error: ("employee not found" + employee_id) });
//     }

//     const newCall = new Call({
//       employee_id,
//       phone_number: phone_number || "UNKNOWN",
//       call_type: call_type || "outgoing",
//       start_ms,
//       end_ms: end_ms || null,
//       duration_seconds: duration_seconds || 0,
//       audio_file: req.file.filename,
//       location
//     });

//     await newCall.save();

//     res.json({
//       ok: true,
//       call: {
//         id: newCall._id,
//         audio_file: newCall.audio_file,
//         uploaded_at: newCall.uploaded_at,
//       },
//     });
//   } catch (err) {
//     console.error("UPLOAD ERROR:", err);
//     res.status(500).json({ error: "upload failed" });
//   }
// });


// /* ============================
//    UPLOAD LOCATION
// ============================ */
// // app.post("/api/location/upload", async (req, res) => {
// //   console.log(req.body);

// //   try {
// //     const { latitude, longitude, timestamp } = req.body;

// //     if (latitude == null || longitude == null) {
// //       return res.status(400).json({ error: "latitude & longitude required" });
// //     }

// //     const location = await Location.create({
// //       employee_id: req.user.id, // 🔐 from JWT
// //       latitude,
// //       longitude,
// //       timestamp: timestamp ? new Date(timestamp) : new Date(),
// //     });

// //     res.status(201).json({
// //       ok: true,
// //       location_id: location._id,
// //     });
// //   } catch (err) {
// //     console.error("LOCATION UPLOAD ERROR:", err);
// //     res.status(500).json({ error: "location upload failed" });
// //   }
// // });

// /* ============================
//    FETCH CALLS
// ============================ */
// app.get("/api/calls", async (req, res) => {
//   try {
//     let calls;

//     // if (req.user.role === "admin") {
//     calls = await Call.find()
//       .populate('employee_id', 'username role')
//       .sort({ uploaded_at: -1 });
//     // } else {
//     // calls = await Call.find({ employee_id: req.user.id })
//     // .populate('employee_id', 'username role')
//     // .sort({ uploaded_at: -1 });
//     // }

//     // Transform the data to match frontend expectations
//     // const transformedCalls = calls.map(call => ({
//     //   id: call._id,
//     //   employee_id: call.employee_id._id,
//     //   employee_name: call.employee_id.username,
//     //   phone_number: call.phone_number,
//     //   call_type: call.call_type,
//     //   start_ms: call.start_ms,
//     //   end_ms: call.end_ms,
//     //   duration_seconds: call.duration_seconds,
//     //   audio_file: call.audio_file,
//     //   uploaded_at: call.uploaded_at,
//     // }));

//     res.json({ ok: true, calls });
//   } catch (err) {
//     console.error("CALL FETCH ERROR:", err);
//     res.status(500).json({ error: "fetch failed" });
//   }
// });

// /* ============================
//    SUMMARY (ADMIN)
// ============================ */
// app.get("/api/summary", async (req, res) => {
//   try {
//     const total = await Call.countDocuments();
//     const outgoing = await Call.countDocuments({ call_type: 'outgoing' });

//     // Use MongoDB aggregation for sum
//     const durationResult = await Call.aggregate([
//       {
//         $group: {
//           _id: null,
//           totalDuration: { $sum: "$duration_seconds" }
//         }
//       }
//     ]);

//     const totalDuration = durationResult.length > 0 ? durationResult[0].totalDuration : 0;

//     res.json({
//       total,
//       outgoing,
//       totalDuration: totalDuration > 60 ? totalDuration / 60 : totalDuration, // Convert to minutes
//     });
//   } catch (err) {
//     console.error("SUMMARY ERROR:", err);
//     res.status(500).json({ error: "summary failed" });
//   }
// });

// /* ============================
//    SERVE AUDIO FILE
// ============================ */
// app.get("/files/:name", authMiddleware, async (req, res) => {
//   try {
//     const { name } = req.params;

//     const call = await Call.findOne({ audio_file: name })
//       .populate('employee_id', '_id');

//     if (!call) return res.sendStatus(404);

//     const owner = call.employee_id._id.toString();
//     if (req.user.role !== "admin" && req.user.id !== owner) {
//       return res.sendStatus(403);
//     }

//     const file = path.join(UPLOAD_DIR, name);
//     if (!fs.existsSync(file)) return res.sendStatus(404);

//     res.sendFile(file);
//   } catch (err) {
//     console.error("AUDIO ERROR:", err);
//     res.sendStatus(500);
//   }
// });

// // Get all users (Admin only)
// // app.get("/api/users", authMiddleware, async (req, res) => {
// //   if (req.user.role !== "admin") {
// //     return res.status(403).json({ error: "forbidden" });
// //   }

// //   try {
// //     const users = await User.find({}, { password_hash: 0 }); // Exclude password
// //     res.json({ ok: true, users });
// //   } catch (err) {
// //     console.error("GET USERS ERROR:", err);
// //     res.status(500).json({ error: "fetch failed" });
// //   }
// // });

// app.get("/api/employees", async (req, res) => {
//   try {
//     const employees = await User.find({ role: 'employee' }, { password_hash: 0 });
//     res.json({ ok: true, employees });
//   } catch (err) {
//     console.error("GET EMPLOYEES ERROR:", err);
//     res.status(500).json({ error: "fetch failed" });
//   }
// });

// // Get specific call by ID
// app.get("/api/calls/:id", authMiddleware, async (req, res) => {
//   try {
//     const call = await Call.findById(req.params.id)
//       .populate('employee_id', 'username role');

//     if (!call) return res.status(404).json({ error: "call not found" });

//     // Check permission
//     if (req.user.role !== "admin" && req.user.id !== call.employee_id._id.toString()) {
//       return res.status(403).json({ error: "forbidden" });
//     }

//     res.json({
//       ok: true,
//       call: {
//         id: call._id,
//         employee_id: call.employee_id._id,
//         employee_name: call.employee_id.username,
//         phone_number: call.phone_number,
//         call_type: call.call_type,
//         start_ms: call.start_ms,
//         end_ms: call.end_ms,
//         duration_seconds: call.duration_seconds,
//         audio_file: call.audio_file,
//         uploaded_at: call.uploaded_at,
//       }
//     });
//   } catch (err) {
//     console.error("GET CALL ERROR:", err);
//     res.status(500).json({ error: "fetch failed" });
//   }
// });

// /* ============================
//    START SERVER
// ============================ */
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, "0.0.0.0", () => {
//   console.log(`Server running on port ${PORT}`);
// });

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
app.use(express.json({ limit: '50mb' })); // Increased limit for larger payloads
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
   UPLOAD SETUP - FIXED FOR LONG RECORDINGS
============================ */
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => cb(null, Date.now() + "_" + file.originalname),
});

// 🔧 INCREASED FILE SIZE LIMIT TO 100MB FOR LONG RECORDINGS
const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    fieldSize: 10 * 1024 * 1024,  // 10MB max field size
  }
});

app.use("/uploads", express.static(UPLOAD_DIR));

/* ============================
   REGISTER (USERNAME + PHONE + PASSWORD)
============================ */

app.post("/api/register", async (req, res) => {
  try {
    const { username, phone_number, password, role } = req.body;

    // 🔴 Validate
    if (!username || !phone_number || !password) {
      return res.status(400).json({
        error: "username, phone_number and password are required",
      });
    }

    // 🔴 Check username
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: "username already exists" });
    }

    // 🔴 Check phone number
    const existingPhone = await User.findOne({ phone_number });
    if (existingPhone) {
      return res.status(409).json({ error: "phone number already exists" });
    }

    // ✅ Create user (password hashed by schema hook)
    const user = await User.create({
      username,
      phone_number,
      password_hash: password,
      role: role || "employee",
    });

    // 🔐 JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.status(201).json({
      ok: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        phone_number: user.phone_number,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});


/* ============================
   LOGIN (USERNAME OR PHONE)
============================ */
app.post("/api/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        error: "identifier and password required",
      });
    }

    // 🔍 Find by username OR phone number
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { phone_number: identifier }
      ]
    });

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

    // ✅ SAME RESPONSE FORMAT (IMPORTANT)
    res.json({
      ok: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        phone_number: user.phone_number,
        role: user.role,
      },
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "login failed" });
  }
});


/* ============================
    Request OTP 
============================ */
app.post("/api/auth/request-reset", async (req, res) => {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({ error: "phone number required" });
    }

    const user = await User.findOne({ phone_number });
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.reset_otp = otp;
    user.reset_otp_expiry = Date.now() + 5 * 60 * 1000; // 5 minutes
    await user.save();

    console.log("RESET OTP:", otp); // 🔔 Replace with SMS gateway later

    res.json({
      ok: true,
      message: "OTP sent to registered mobile number",
    });

  } catch (err) {
    console.error("REQUEST RESET ERROR:", err);
    res.status(500).json({ error: "failed to send OTP" });
  }
});


/* ============================
    Verify OTP 
============================ */

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { phone_number, otp, new_password } = req.body;

    if (!phone_number || !otp || !new_password) {
      return res.status(400).json({ error: "all fields required" });
    }

    const user = await User.findOne({
      phone_number,
      reset_otp: otp,
      reset_otp_expiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "invalid or expired OTP" });
    }

    // 🔐 Update password (hash via pre-save hook)
    user.password_hash = new_password;
    user.reset_otp = null;
    user.reset_otp_expiry = null;

    await user.save();

    res.json({
      ok: true,
      message: "Password reset successful",
    });

  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({ error: "password reset failed" });
  }
});


/* ============================
   UPLOAD CALL - FIXED FOR LONG RECORDINGS
============================ */
app.post("/api/upload", upload.single("audio_file"), async (req, res) => {
  try {
    if (!req.file) {
      console.error("❌ No file received in upload request");
      return res.status(400).json({ error: "audio file missing" });
    }

    // Verify file was actually saved
    const filePath = path.join(UPLOAD_DIR, req.file.filename);
    if (!fs.existsSync(filePath)) {
      console.error("❌ File not found after upload:", filePath);
      return res.status(500).json({ error: "file save failed" });
    }

    console.log("📁 File received:", req.file.filename, "Size:", req.file.size, "bytes");
    console.log("📂 File path:", filePath);

    const meta = JSON.parse(req.body.metadata.trim() || "{}");
    console.log("📋 Metadata:", meta);

    const {
      employee_id,
      phone_number,
      call_type,
      start_ms,
      end_ms,
      duration_seconds,
      location,
    } = meta;

    if (!employee_id) {
      // Clean up uploaded file if metadata invalid
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: "invalid metadata: employee_id required" });
    }

    const employee = await User.findById(employee_id);
    if (!employee) {
      // Clean up uploaded file if employee not found
      fs.unlinkSync(filePath);
      return res.status(404).json({ error: ("employee not found: " + employee_id) });
    }

    const newCall = new Call({
      employee_id,
      phone_number: phone_number || "UNKNOWN",
      call_type: call_type || "outgoing",
      start_ms,
      end_ms: end_ms || null,
      duration_seconds: duration_seconds || 0,
      audio_file: req.file.filename,
      location
    });

    await newCall.save();

    console.log("✅ Call saved:", newCall._id, "Duration:", duration_seconds, "seconds");
    console.log("✅ Audio file:", req.file.filename, "stored at:", filePath);

    res.json({
      ok: true,
      call: {
        id: newCall._id,
        audio_file: newCall.audio_file,
        duration_seconds: newCall.duration_seconds,
        uploaded_at: newCall.uploaded_at,
      },
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    // Clean up file if database save failed
    if (req.file) {
      const filePath = path.join(UPLOAD_DIR, req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("🗑️ Cleaned up file after error:", req.file.filename);
      }
    }
    res.status(500).json({ error: "upload failed: " + err.message });
  }
});

/* ============================
   FETCH CALLS
============================ */
app.get("/api/calls", async (req, res) => {
  try {
    let calls;

    calls = await Call.find()
      .populate('employee_id', 'username role')
      .sort({ uploaded_at: -1 });

    res.json({ ok: true, calls });
  } catch (err) {
    console.error("CALL FETCH ERROR:", err);
    res.status(500).json({ error: "fetch failed" });
  }
});

/* ============================
   SUMMARY (ADMIN)
============================ */
app.get("/api/summary", async (req, res) => {
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
      totalDuration: totalDuration > 60 ? totalDuration / 60 : totalDuration, // Convert to minutes
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
   SERVE AUDIO FILE (PUBLIC) - No Auth
============================ */
app.get("/uploads/:name", (req, res) => {
  try {
    const { name } = req.params;
    const file = path.join(UPLOAD_DIR, name);
    
    console.log("🔊 Audio request for:", name);
    console.log("📂 Looking at path:", file);
    
    if (!fs.existsSync(file)) {
      console.error("❌ File not found:", file);
      
      // List all files in uploads directory for debugging
      const files = fs.readdirSync(UPLOAD_DIR);
      console.log("📁 Available files:", files);
      
      return res.status(404).json({ 
        error: "file not found",
        requested: name,
        available_files: files
      });
    }

    console.log("✅ Serving file:", name);
    res.sendFile(file);
  } catch (err) {
    console.error("AUDIO SERVE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================
   DEBUG: List all uploaded files
============================ */
app.get("/api/debug/files", (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    res.json({
      upload_directory: UPLOAD_DIR,
      total_files: files.length,
      files: files.map(f => ({
        name: f,
        size: fs.statSync(path.join(UPLOAD_DIR, f)).size,
        url: `/uploads/${f}`
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/employees", async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' }, { password_hash: 0 });
    res.json({ ok: true, employees });
  } catch (err) {
    console.error("GET EMPLOYEES ERROR:", err);
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
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

// 🔧 INCREASE SERVER TIMEOUT FOR LONG UPLOADS
server.timeout = 300000; // 5 minutes timeout
server.keepAliveTimeout = 300000;
server.headersTimeout = 310000;
