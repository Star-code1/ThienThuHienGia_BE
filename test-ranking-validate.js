const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();
const connectDB = require('./config/db');
const axios = require('axios');

(async () => {
  try {
    await connectDB();
    const { getMembersByRoleId } = require('./routes/guildRoutes');
    const Event = require('./models/Event');
    const Attendance = require('./models/Attendance');

    const TARGET_CHANNEL_ID = '1515709357856264212';
    const TARGET_ROLE_ID = '1438967271149146302';

    const events = await Event.find({ channelId: TARGET_CHANNEL_ID }).lean();
    console.log(`Số sự kiện thuộc kênh ${TARGET_CHANNEL_ID}: ${events.length}`);

    const members = await getMembersByRoleId(TARGET_ROLE_ID);
    console.log(`Số thành viên có role ${TARGET_ROLE_ID}: ${members.length}`);

    console.log('✅ Hệ thống Backend sẵn sàng cho bảng xếp hạng!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
