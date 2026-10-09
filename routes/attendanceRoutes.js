const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Event = require('../models/Event');
const { getMembersByRoleId } = require('./guildRoutes');

// Cấu hình phạm vi đánh giá Ranking theo yêu cầu:
// • Chỉ đánh giá các sự kiện thuộc Kênh ID: 1515709357856264212
// • Chỉ đánh giá các thành viên sở hữu Role ID: 1438967271149146302
const TARGET_CHANNEL_ID = '1515709357856264212';
const TARGET_ROLE_ID = '1438967271149146302';

// GET /api/attendance/rankings/absent - Bảng xếp hạng điểm danh & điểm công tội
router.get('/rankings/absent', async (req, res) => {
  try {
    const { days, limit = 100 } = req.query;

    // 1. Chỉ lấy sự kiện thuộc Kênh 1515709357856264212
    const eventQuery = { channelId: TARGET_CHANNEL_ID };
    if (days && !isNaN(parseInt(days, 10))) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - parseInt(days, 10));
      eventQuery.createdAt = { $gte: pastDate };
    }

    const events = await Event.find(eventQuery).sort({ createdAt: -1 }).lean();
    const totalEventsCount = events.length;

    if (totalEventsCount === 0) {
      return res.json({
        success: true,
        targetChannelId: TARGET_CHANNEL_ID,
        targetRoleId: TARGET_ROLE_ID,
        totalEvents: 0,
        totalRanked: 0,
        data: []
      });
    }

    const eventIds = events.map((e) => e.messageId);

    // 2. Lấy tất cả lượt điểm danh của các sự kiện thuộc kênh này
    const allAttendances = await Attendance.find({
      eventId: { $in: eventIds }
    }).lean();

    // Lập Map tra cứu: eventId -> Map(userId -> AttendanceRecord)
    const eventAttendanceMap = new Map();
    allAttendances.forEach((att) => {
      if (!eventAttendanceMap.has(att.eventId)) {
        eventAttendanceMap.set(att.eventId, new Map());
      }
      eventAttendanceMap.get(att.eventId).set(att.userId, att);
    });

    // 3. Chỉ lấy các thành viên sở hữu Role ID 1438967271149146302
    const targetMembers = await getMembersByRoleId(TARGET_ROLE_ID);
    const validUserIds = new Set(targetMembers.map((m) => m.userId));

    // Map tổng hợp thành viên: userId -> MemberStats
    const membersMap = new Map();

    targetMembers.forEach((gm) => {
      membersMap.set(gm.userId, {
        userId: gm.userId,
        username: gm.username,
        displayName: gm.displayName || gm.username,
        className: gm.className || 'Chưa rõ',
        role: gm.roleName || 'Bang Chúng',
        avatar: gm.avatar,
        joinedAt: gm.joinedAt || null,
        totalEvents: 0,         // Số trận áp dụng cho thành viên (tính từ ngày vào bang)
        explicitAbsentCount: 0, // Báo vắng (-0.5đ)
        unvotedCount: 0,        // Không vote (-2đ)
        noShowCount: 0,         // Vote mà không đánh (-3đ)
        attendedCount: 0,       // Vote đánh/dự bị thực tế (+1đ)
        tentativeCount: 0,      // Chưa chắc chắn (0đ)
        totalAbsentCount: 0,    // Tổng vắng = Báo vắng + Không vote + Không đánh
        reputationScore: 0,     // Tổng điểm công tội
        absenceRate: 0,
        lastAbsentDate: null,
        lastVoteDate: null
      });
    });

    // 4. Đối soát từng Event thuộc kênh mục tiêu với từng Member có role mục tiêu
    // Công thức tính điểm công tội:
    // • Không vote: -2 điểm (chỉ phạt các trận diễn ra sau khi thành viên vào server)
    // • Báo vắng: -0.5 điểm
    // • Vote đánh / dự bị: +1 điểm
    // • Vote mà không đánh (No-Show): -3 điểm
    for (const event of events) {
      const attMapForEvent = eventAttendanceMap.get(event.messageId) || new Map();
      const eventTime = event.date
        ? new Date(event.date).getTime()
        : (event.createdAt ? new Date(event.createdAt).getTime() : 0);

      for (const [userId, member] of membersMap.entries()) {
        const att = attMapForEvent.get(userId);
        const memberJoinTime = member.joinedAt ? new Date(member.joinedAt).getTime() : 0;

        // Nếu sự kiện diễn ra TRƯỚC KHI thành viên vào server và thành viên không có vote
        // -> Miễn trừ hoàn toàn (không phạt không vote -2đ và không tính vào tổng trận)
        const isEventBeforeJoined = memberJoinTime > 0 && eventTime > 0 && memberJoinTime > eventTime;

        if (att) {
          // Thành viên ĐÃ VOTE trong sự kiện này
          member.totalEvents++;
          if (att.noShow) {
            // Vote đánh/dự bị nhưng BỊ ĐÁNH DẤU LÀ KHÔNG ĐÁNH (-3 điểm)
            member.noShowCount++;
            member.totalAbsentCount++;
            if (!member.lastAbsentDate || new Date(att.timestamp) > new Date(member.lastAbsentDate)) {
              member.lastAbsentDate = att.timestamp;
            }
          } else if (att.status === 'absent') {
            // Báo vắng (-0.5 điểm)
            member.explicitAbsentCount++;
            member.totalAbsentCount++;
            if (!member.lastAbsentDate || new Date(att.timestamp) > new Date(member.lastAbsentDate)) {
              member.lastAbsentDate = att.timestamp;
            }
          } else if (['present', 'bench', 'late'].includes(att.status)) {
            // Vote đánh / dự bị hợp lệ (+1 điểm)
            member.attendedCount++;
          } else if (att.status === 'tentative') {
            // Chưa chắc chắn (0 điểm)
            member.tentativeCount++;
          }

          if (!member.lastVoteDate || new Date(att.timestamp) > new Date(member.lastVoteDate)) {
            member.lastVoteDate = att.timestamp;
          }
        } else {
          // Thành viên KHÔNG VOTE
          if (isEventBeforeJoined) {
            // Sự kiện diễn ra trước khi vào bang -> Miễn trừ!
            continue;
          }

          // Sự kiện diễn ra sau khi đã vào server -> Phạt không vote (-2 điểm) & Tính là vắng
          member.totalEvents++;
          member.unvotedCount++;
          member.totalAbsentCount++;
        }
      }
    }

    // 5. Tính tổng điểm công tội và tỷ lệ % vắng mặt
    const rankings = Array.from(membersMap.values()).map((m) => {
      // (Đánh/Dự bị * 1) + (Báo vắng * -0.5) + (Không vote * -2) + (Không đánh * -3)
      const score = (m.attendedCount * 1) + (m.explicitAbsentCount * -0.5) + (m.unvotedCount * -2) + (m.noShowCount * -3);
      const roundedScore = Math.round(score * 10) / 10;

      const rate = m.totalEvents > 0
        ? Math.round((m.totalAbsentCount / m.totalEvents) * 1000) / 10
        : 0;

      return {
        ...m,
        reputationScore: roundedScore,
        absenceRate: rate
      };
    });

    // Mặc định sắp xếp theo tổng điểm tăng dần
    rankings.sort((a, b) => {
      return (
        a.reputationScore - b.reputationScore ||
        b.totalAbsentCount - a.totalAbsentCount ||
        b.noShowCount - a.noShowCount
      );
    });

    const finalRankings = rankings.slice(0, parseInt(limit, 10));

    res.json({
      success: true,
      targetChannelId: TARGET_CHANNEL_ID,
      targetRoleId: TARGET_ROLE_ID,
      totalEvents: totalEventsCount,
      totalRanked: finalRankings.length,
      data: finalRankings
    });
  } catch (error) {
    console.error('Lỗi tính bảng xếp hạng vắng mặt & điểm công tội:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/attendance/:eventId/toggle-no-show - Đánh dấu/Hủy đánh dấu Vote mà không đánh (-3 điểm)
router.put('/:eventId/toggle-no-show', async (req, res) => {
  const { eventId } = req.params;
  const { userId, noShow, updatedBy } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'Thiếu userId' });
  }

  try {
    const attendance = await Attendance.findOneAndUpdate(
      { eventId, userId },
      {
        noShow: Boolean(noShow),
        noShowMarkedBy: updatedBy || 'Quản Trị Viên',
        noShowMarkedAt: new Date()
      },
      { new: true, upsert: false }
    );

    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi điểm danh của thành viên này trong sự kiện.' });
    }

    res.json({
      success: true,
      message: noShow ? 'Đã đánh dấu thành viên VOTE MÀ KHÔNG ĐÁNH (-3 điểm)' : 'Đã hủy đánh dấu không đánh',
      attendance
    });
  } catch (error) {
    console.error('Lỗi toggle no-show:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/attendance/:eventId/unvoted - Lấy danh sách thành viên có role mục tiêu chưa vote trong sự kiện
router.get('/:eventId/unvoted', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { roleId = TARGET_ROLE_ID } = req.query;

    const event = await Event.findOne({ messageId: eventId }).lean();
    const eventTime = event
      ? (event.date ? new Date(event.date).getTime() : (event.createdAt ? new Date(event.createdAt).getTime() : 0))
      : 0;

    const [targetMembers, attendances] = await Promise.all([
      getMembersByRoleId(roleId),
      Attendance.find({ eventId }).lean()
    ]);

    const votedUserIds = new Set(attendances.map((a) => a.userId));

    const unvotedMembers = targetMembers.filter((m) => {
      // Đã vote thì không tính là unvoted
      if (votedUserIds.has(m.userId)) return false;

      // Nếu sự kiện diễn ra trước khi thành viên vào server -> bỏ qua
      const memberJoinTime = m.joinedAt ? new Date(m.joinedAt).getTime() : 0;
      if (memberJoinTime > 0 && eventTime > 0 && memberJoinTime > eventTime) {
        return false;
      }

      return true;
    });

    res.json({
      success: true,
      eventId,
      targetRoleId: roleId,
      totalUnvoted: unvotedMembers.length,
      unvotedMembers
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách chưa vote:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/attendance/:eventId - Lấy danh sách thành viên điểm danh của 1 event
router.get('/:eventId', async (req, res) => {
  try {
    const attendances = await Attendance.find({ eventId: req.params.eventId }).lean();
    res.json(attendances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;