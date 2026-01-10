// auth.js
const jwt = require('jsonwebtoken');
const { User } = require('./model/models');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user in MongoDB
    const user = await User.findById(decoded.id).select('-password_hash');

    if (!user) {
      throw new Error();
    }
    req.user = {
      id: user._id,
      role: user.role,
      username: user.username
    };

    next();
  } catch (err) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

module.exports = authMiddleware;