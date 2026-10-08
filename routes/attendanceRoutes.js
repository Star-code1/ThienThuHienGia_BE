const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Event = require('../models/Event');
const { getGuildMembersList } = require('./guildRoutes');

// GET /api/attendance/rankings/absent - Bảng xếp hạng điểm danh & điểm công tội toàn diện
router.get('/rankings/absent', async (req, res) => {
  try {
    const { days, limit = 100 } = req.query;

    const eventQuery = {};
    if (days && !isNaN(parseInt(days, 10))) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - parseInt(days, 10));
      eventQuery.createdAt = { $gte: pastDate };
    }

    // 1. Lấy tất cả sự kiện hợp lệ trong kỳ xét
    const events = await Event.find(eventQuery).sort({ createdAt: -1 }).lean();
    const totalEventsCount = events.length;

    if (totalEventsCount === 0) {
      return res.json({
        success: true,
        totalEvents: 0,
        totalRanked: 0,
        data: []
      });
    }

    const eventIds = events.map((e) => e.messageId);

    // 2. Lấy tất cả các lượt điểm danh của những sự kiện này
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

    // 3. Lấy danh sách thành viên Bang Chúng hiện tại
    const guildMembers = await getGuildMembersList();

    // Map tổng hợp thành viên: userId -> MemberStats
    const membersMap = new Map();

    // Nạp toàn bộ thành viên từ Guild
    guildMembers.forEach((gm) => {
      membersMap.set(gm.userId, {
        userId: gm.userId,
        username: gm.username,
        displayName: gm.displayName || gm.username,
        className: gm.className || 'Chưa rõ',
        role: gm.roleName || 'Bang Chúng',
        avatar: gm.avatar,
        totalEvents: totalEventsCount,
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

    // Nạp thêm những ai từng điểm danh
    allAttendances.forEach((att) => {
      if (!membersMap.has(att.userId)) {
        membersMap.set(att.userId, {
          userId: att.userId,
          username: att.username,
          displayName: att.displayName || att.username,
          className: att.className || 'Chưa rõ',
          role: att.role || 'Bang Chúng',
          avatar: `https://cdn.discordapp.com/embed/avatars/${(BigInt(att.userId) >> 22n) % 6n}.png`,
          totalEvents: totalEventsCount,
          explicitAbsentCount: 0,
          unvotedCount: 0,
          noShowCount: 0,
          attendedCount: 0,
          tentativeCount: 0,
          totalAbsentCount: 0,
          reputationScore: 0,
          absenceRate: 0,
          lastAbsentDate: null,
          lastVoteDate: null
        });
      }
    });

    // 4. Đối soát từng Event với từng Member để tính điểm công tội theo công thức:
    // • Không vote: -2 điểm
    // • Báo vắng: -0.5 điểm
    // • Vote đánh / dự bị: +1 điểm
    // • Vote mà không đánh (No-Show): -3 điểm
    for (const event of events) {
      const attMapForEvent = eventAttendanceMap.get(event.messageId) || new Map();

      for (const [userId, member] of membersMap.entries()) {
        const att = attMapForEvent.get(userId);

        if (att) {
          // Thành viên ĐÃ VOTE
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
          // Thành viên KHÔNG VOTE (-2 điểm) -> Tính là Vắng mặt
          member.unvotedCount++;
          member.totalAbsentCount++;
        }
      }
    }

    // 5. Tính tổng điểm công tội và tỷ lệ % vắng mặt
    const rankings = Array.from(membersMap.values()).map((m) => {
      // Công thức tổng điểm: (Đánh/Dự bị * 1) + (Báo vắng * -0.5) + (Không vote * -2) + (Không đánh * -3)
      const score = (m.attendedCount * 1) + (m.explicitAbsentCount * -0.5) + (m.unvotedCount * -2) + (m.noShowCount * -3);
      const roundedScore = Math.round(score * 10) / 10;

      const rate = totalEventsCount > 0
        ? Math.round((m.totalAbsentCount / totalEventsCount) * 1000) / 10
        : 0;

      return {
        ...m,
        reputationScore: roundedScore,
        absenceRate: rate
      };
    });

    // Mặc định sắp xếp theo Tổng điểm tăng dần (ai bị điểm âm/thấp nhất thì đứng đầu danh sách vắng)
    // Hoặc theo tổng số trận vắng giảm dần
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