const express = require('express');
const router = express.Router();
const axios = require('axios');

const ROLE_DUONG_GIA = '1438965974345842768';
const ROLE_DUONG_CHU = '1438966724082012290';
const ROLE_BANG_CHUNG = '1438967271149146302';

const CLASS_ROLE_MAP = {
  '1479112953813795038': 'Long Ngâm',
  '1439916836895588493': 'Toái Mộng',
  '1439916573031796767': 'Thần Tương',
  '1439916668963782696': 'Huyết Hà',
  '1439916770528854046': 'Tố Vấn',
  '1439916801550061661': 'Thiết Y',
  '1439916837277008005': 'Cửu Linh'
};

const CLASS_KEYWORDS = [
  { name: 'Tố Vấn', keys: ['tố vấn', 'to van', 'tovan', '[tv]', 'tv_'] },
  { name: 'Huyết Hà', keys: ['huyết hà', 'huyet ha', 'huyetha', '[hh]', 'hh_'] },
  { name: 'Thần Tương', keys: ['thần ', 'than tuong', 'thantuong', '[tt]', 'tt_'] },
  { name: 'Toái Mộng', keys: ['toái mộng', 'toai mong', 'toaimong', '[tm]', 'tm_'] },
  { name: 'Thiết Y', keys: ['thiết y', 'thiet y', 'thiety', '[ty]', 'ty_'] },
  { name: 'Long Ngâm', keys: ['long ngâm', 'long ngam', 'longngam', '[ln]', 'ln_'] },
  { name: 'Cửu Linh', keys: ['cửu linh', 'cuu linh', 'cuulinh', '[cl]', 'cl_'] }
];

function getClassFromRoles(roleIds, nickname) {
  for (const rId of roleIds || []) {
    if (CLASS_ROLE_MAP[rId]) {
      return CLASS_ROLE_MAP[rId];
    }
  }
  if (!nickname) return 'Chưa rõ';
  const lower = nickname.toLowerCase();
  for (const item of CLASS_KEYWORDS) {
    if (item.keys.some((k) => lower.includes(k))) {
      return item.name;
    }
  }
  return 'Chưa rõ';
}

// In-memory cache for Discord guild members to avoid rate limits & latency
let cachedMembersData = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes (giảm tối đa số request gửi tới Discord API)

/**
 * GET /api/guild/members
 * Fetch all guild members having "Bang Chúng" role ID (or Leader role IDs)
 * and map exact Class Role IDs to martial class
 */
router.get('/members', async (req, res) => {
  const now = Date.now();
  const forceRefresh = req.query.refresh === 'true';

  // Return cached result immediately if valid
  if (!forceRefresh && cachedMembersData && (now - lastCacheTime < CACHE_TTL_MS)) {
    return res.json(cachedMembersData);
  }

  try {
    const allowedGuildId = process.env.ALLOWED_GUILD_ID;
    const botToken = process.env.DISCORD_BOT_TOKEN;

    if (!allowedGuildId || !botToken) {
      return res.json({
        success: true,
        totalBangChungMembers: 0,
        members: []
      });
    }

    // Fetch All Server Members via Discord Bot API (up to 1000)
    const membersRes = await axios.get(`https://discord.com/api/v10/guilds/${allowedGuildId}/members?limit=1000`, {
      headers: { Authorization: `Bot ${botToken}` }
    });

    const allMembers = membersRes.data || [];

    // Filter members with exact Role IDs
    const bangChungMembers = allMembers
      .filter((m) => {
        const roles = m.roles || [];
        return (
          roles.includes(ROLE_BANG_CHUNG) ||
          roles.includes(ROLE_DUONG_GIA) ||
          roles.includes(ROLE_DUONG_CHU)
        );
      })
      .map((m) => {
        const nick = m.nick || m.user.global_name || m.user.username;
        const userRoleIds = m.roles || [];
        const userRoles = [];

        if (userRoleIds.includes(ROLE_DUONG_GIA)) userRoles.push('Đương Gia');
        if (userRoleIds.includes(ROLE_DUONG_CHU)) userRoles.push('Đường Chủ');
        if (userRoleIds.includes(ROLE_BANG_CHUNG)) userRoles.push('Bang Chúng');

        const detectedClass = getClassFromRoles(userRoleIds, nick);

        return {
          userId: m.user.id,
          discordId: m.user.id,
          username: m.user.username,
          globalName: m.user.global_name || m.user.username,
          displayName: nick,
          nickname: nick,
          className: detectedClass,
          avatar: m.user.avatar
            ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=128`
            : `https://cdn.discordapp.com/embed/avatars/${(BigInt(m.user.id) >> 22n) % 6n}.png`,
          roles: userRoles,
          roleName: userRoles.join(', ') || 'Bang Chúng'
        };
      });

    const result = {
      success: true,
      totalBangChungMembers: bangChungMembers.length,
      members: bangChungMembers
    };

    cachedMembersData = result;
    lastCacheTime = Date.now();

    return res.json(result);
  } catch (error) {
    console.error('Fetch Guild Members Error:', error.response?.data || error.message);
    if (cachedMembersData) {
      return res.json(cachedMembersData);
    }
    return res.json({
      success: true,
      totalBangChungMembers: 0,
      members: [],
      error: error.message
    });
  }
});

module.exports = router;
