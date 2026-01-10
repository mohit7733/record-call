// models.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
function generateShortId() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}
// User Schema
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
        enum: ['admin', 'employee'],
        default: 'employee',
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
});

// Call Schema
const callSchema = new mongoose.Schema({
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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
    uploaded_at: {
        type: Date,
        default: Date.now,
    },
});

// Hash password before saving
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

// Compare password method
userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password_hash);
};

const User = mongoose.model('RecordingUser', userSchema);
const Call = mongoose.model('RecordingCall', callSchema);

module.exports = { User, Call };
