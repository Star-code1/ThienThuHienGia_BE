const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Get token from header
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ message: 'Không tìm thấy token xác thực, truy cập bị từ chối.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return res.status(401).json({ message: 'Token không hợp lệ.' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'thienthumon_secret_jwt_key_2026';
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token đã hết hạn hoặc không hợp lệ.' });
  }
};
