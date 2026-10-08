const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();
const connectDB = require('./config/db');
const { getMembersByRoleId, getGuildMembersList } = require('./routes/guildRoutes');

(async () => {
  try {
    console.log('🔗 Kết nối MongoDB...');
    await connectDB();

    console.log('🧪 Đang test getMembersByRoleId(1438967271149146302)...');
    const roleMembers = await getMembersByRoleId('1438967271149146302');
    console.log(`✅ Lấy thành công ${roleMembers.length} thành viên có role 1438967271149146302 từ MongoDB!`);

    console.log('🧪 Đang test getGuildMembersList()...');
    const guildMembers = await getGuildMembersList();
    console.log(`✅ Lấy thành công ${guildMembers.length} thành viên Bang Chúng từ MongoDB!`);

    console.log('\n📄 Mẫu 2 thành viên từ Backend:');
    roleMembers.slice(0, 2).forEach((m, idx) => {
      console.log(`  ${idx + 1}. [${m.className}] ${m.displayName} (@${m.username}) - Role: ${m.roleName}`);
    });

    console.log('\n🎉 Backend đã hoạt động mượt mà độc lập với Discord REST API / Cloudflare rate limits!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  }
})();
