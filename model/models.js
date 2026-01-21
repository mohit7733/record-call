const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

/* ============================
   UTIL
============================ */
function generateShortId() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

/* ============================
   USER SCHEMA
============================ */

const userSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateShortId,
    },

    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },

    password_hash: {
        type: String,
        required: true,
    },

    role: {
        type: String,
        enum: ["admin", "employee"],
        default: "employee",
    },

    phone_number: {
        type: String,
        required: true,
        unique: true,
    },

    // 🔐 FORGOT PASSWORD FIELDS
    reset_otp: String,
    reset_otp_expiry: Date,

    created_at: {
        type: Date,
        default: Date.now,
    },
});


/* ============================
   PASSWORD HASH HOOK
============================ */

userSchema.pre("save", async function (next) {
    // If password not changed, skip hashing
    if (!this.isModified("password_hash")) return next();

    try {
        this.password_hash = await bcrypt.hash(this.password_hash, 10);
        next();
    } catch (err) {
        next(err);
    }
});

/* ============================
   PASSWORD COMPARE METHOD
============================ */

userSchema.methods.comparePassword = function (plainPassword) {
    return bcrypt.compare(plainPassword, this.password_hash);
};

module.exports.User = mongoose.model("User", userSchema);
/* ============================
   CALL SCHEMA 
============================ */
const callSchema = new mongoose.Schema({
    employee_id: {
        type: String,
        ref: 'RecordingUser',
        required: true,
    },
    phone_number: {
        type: String,
        default: 'UNKNOWN',
    },
    call_type: {
        type: String,
        enum: ['incoming', 'outgoing'],
        default: 'outgoing',
    },
    start_ms: {
        type: Number,
        required: true,
    },
    end_ms: {
        type: Number,
    },
    duration_seconds: {
        type: Number,
        default: 0,
    },
    audio_file: {
        type: String,
        required: true,
    },
    location: {
        type: Object,
        default: null,
    },
    uploaded_at: {
        type: Date,
        default: Date.now,
    },
});

/* ============================
   LOCATION SCHEMA 
============================ */
// const locationSchema = new mongoose.Schema({
//     employee_id: {
//         type: String,
//         ref: 'RecordingUser',
//         required: true,
//     },
//     latitude: {
//         type: Number,
//         required: true,
//     },
//     longitude: {
//         type: Number,
//         required: true,
//     },
//     timestamp: {
//         type: Date,
//         required: true,
//     },
//     created_at: {
//         type: Date,
//         default: Date.now,
//     },
// });

/* ============================
   PASSWORD HOOK
============================ */
userSchema.pre('save', async function (next) {
    if (!this.isModified('password_hash')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password_hash = await bcrypt.hash(this.password_hash, salt);
        next();
    } catch (err) {
        next(err);
    }
});

/* ============================
   PASSWORD CHECK
============================ */
userSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password_hash);
};

/* ============================
   MODELS
============================ */
const User = mongoose.model('RecordingUser', userSchema);
const Call = mongoose.model('RecordingCall', callSchema);
// const Location = mongoose.model('RecordingLocation', locationSchema);

module.exports = { User, Call };
