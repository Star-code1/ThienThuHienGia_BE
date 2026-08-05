const express = require('express');
const router = express.Router();
const MatchAnalysis = require('../models/MatchAnalysis');
const authMiddleware = require('../middleware/auth');
const { uploadToCloudinary } = require('../config/cloudinary');

/**
 * POST /api/match-analysis/upload-image
 * Upload image file / base64 to Cloudinary and return CDN URL
 */
router.post('/upload-image', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ thành viên có vai trò Đương Gia hoặc Đường Chủ mới có quyền upload ảnh trận đấu.'
      });
    }

    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'Dữ liệu ảnh không hợp lệ.' });
    }

    const cdnUrl = await uploadToCloudinary(image, 'thienthu_match_analysis');
    return res.json({
      success: true,
      url: cdnUrl
    });
  } catch (error) {
    console.error('Lỗi upload ảnh Cloudinary:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi upload ảnh lên Cloudinary.' });
  }
});

/**
 * GET /api/match-analysis
 * Fetch all match analysis records sorted by date descending
 */
router.get('/', async (req, res) => {
  try {
    const list = await MatchAnalysis.find().sort({ eventDate: -1, createdAt: -1 });
    return res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách dữ liệu trận đấu:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy dữ liệu trận đấu.' });
  }
});

/**
 * POST /api/match-analysis
 * Create new match analysis record
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ thành viên có vai trò Đương Gia hoặc Đường Chủ mới có quyền đăng dữ liệu trận đấu.'
      });
    }

    const { matchTitle, eventDate, result, mistakes, improvements, images } = req.body;

    if (!matchTitle || !mistakes) {
      return res.status(400).json({
        success: false,
        message: 'Tên trận đấu và ghi chú các việc sai sót cần sửa đổi không được để trống.'
      });
    }

    const authorData = {
      discordId: req.user.discordId || req.user.id,
      name: req.user.nickname || req.user.globalName || req.user.username || 'Thành Viên',
      avatar: req.user.avatar || '',
      className: req.user.className || 'Bang Chúng'
    };

    const newRecord = new MatchAnalysis({
      matchTitle: matchTitle.trim(),
      eventDate: eventDate ? new Date(eventDate) : new Date(),
      result: result || 'loss',
      mistakes,
      improvements: improvements || '',
      images: Array.isArray(images) ? images : [],
      author: authorData
    });

    await newRecord.save();

    return res.status(201).json({
      success: true,
      message: 'Đã lưu dữ liệu trận đấu và ghi chú sai sót thành công!',
      record: newRecord
    });
  } catch (error) {
    console.error('Lỗi tạo dữ liệu trận đấu:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lưu dữ liệu trận đấu.' });
  }
});

/**
 * PUT /api/match-analysis/:id
 * Update match analysis record
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ thành viên có vai trò Đương Gia hoặc Đường Chủ mới có quyền chỉnh sửa dữ liệu trận đấu.'
      });
    }

    const record = await MatchAnalysis.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu trận đấu.' });
    }

    const { matchTitle, eventDate, result, mistakes, improvements, images } = req.body;

    if (matchTitle) record.matchTitle = matchTitle.trim();
    if (eventDate) record.eventDate = new Date(eventDate);
    if (result) record.result = result;
    if (mistakes) record.mistakes = mistakes;
    if (improvements !== undefined) record.improvements = improvements;
    if (Array.isArray(images)) record.images = images;

    await record.save();

    return res.json({
      success: true,
      message: 'Đã cập nhật dữ liệu trận đấu thành công!',
      record
    });
  } catch (error) {
    console.error('Lỗi cập nhật dữ liệu trận đấu:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật dữ liệu.' });
  }
});

/**
 * DELETE /api/match-analysis/:id
 * Delete match analysis record
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ thành viên có vai trò Đương Gia hoặc Đường Chủ mới có quyền xóa dữ liệu trận đấu.'
      });
    }

    const record = await MatchAnalysis.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu trận đấu.' });
    }

    await MatchAnalysis.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: 'Đã xóa dữ liệu trận đấu.'
    });
  } catch (error) {
    console.error('Lỗi xóa dữ liệu trận đấu:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi xóa dữ liệu.' });
  }
});

module.exports = router;
