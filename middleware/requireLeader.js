/**
 * Middleware checking if the authenticated user has leader/editor permissions
 * Only users with Discord roles "Đương Gia" or "Đường chủ" are granted canEdit === true
 */
module.exports = function (req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập trước khi thực hiện thao tác này.' });
  }

  if (!req.user.canEdit) {
    return res.status(403).json({
      success: false,
      message: 'Truy cập bị từ chối. Chỉ thành viên có Chức vị "Đương Gia" hoặc "Đường chủ" mới có quyền chỉnh sửa!'
    });
  }

  next();
};
