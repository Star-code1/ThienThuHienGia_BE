const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// Exact Role IDs from Discord Server for Leadership & Member Verification
const ROLE_DUONG_GIA = '1438965974345842768'; // Đương Gia (Leader / Can Edit)
const ROLE_DUONG_CHU = '1438966724082012290'; // Đường Chủ (Leader / Can Edit)
const ROLE_BANG_CHUNG = '1438967271149146302'; // Bang Chúng (Required Member Role)

// Exact Role IDs from Discord Server for Martial Classes (Võ Phái)
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
  // Fallback to nickname text parsing if no class role assigned
  if (!nickname) return 'Chưa rõ';
  const lower = nickname.toLowerCase();
  for (const item of CLASS_KEYWORDS) {
    if (item.keys.some((k) => lower.includes(k))) {
      return item.name;
    }
  }
  return 'Chưa rõ';
}

/**
 * POST /api/auth/discord
 * Exchange code, verify Role IDs & assign Class from Class Role IDs
 */
router.post('/discord', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Mã xác thực (code) Discord không được cung cấp.' });
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const configuredRedirectUri = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/auth/callback';
    const targetRedirectUri = redirectUri || configuredRedirectUri;
    const allowedGuildId = process.env.ALLOWED_GUILD_ID;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const jwtSecret = process.env.JWT_SECRET || 'thienthumon_secret_jwt_key_2026';

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        success: false,
        message: 'Cấu hình Server thiếu DISCORD_CLIENT_ID hoặc DISCORD_CLIENT_SECRET trong file .env'
      });
    }

    // 1. Exchange Code for Access Token
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: targetRedirectUri
    });

    let tokenResponse;
    try {
      tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token', tokenParams.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
    } catch (err) {
      console.error('Discord Token Exchange Error:', err.response?.data || err.message);
      return res.status(400).json({
        success: false,
        message: 'Mã xác thực Discord đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.'
      });
    }

    const { access_token } = tokenResponse.data;

    // 2. Fetch User Profile
    const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const discordUser = userResponse.data;

    // 3. Fetch Guild Member Details via Bot Token API
    let guildMember = null;
    let memberRoleIds = [];
    let isBangChungMember = false;
    let canEditPermission = false;

    if (allowedGuildId && botToken) {
      try {
        const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${allowedGuildId}/members/${discordUser.id}`, {
          headers: { Authorization: `Bot ${botToken}` }
        });
        guildMember = memberRes.data;
        memberRoleIds = guildMember?.roles || [];

        // Check required Role ID "Bang Chúng" (1438967271149146302) or Leader Role IDs
        isBangChungMember =
          memberRoleIds.includes(ROLE_BANG_CHUNG) ||
          memberRoleIds.includes(ROLE_DUONG_GIA) ||
          memberRoleIds.includes(ROLE_DUONG_CHU);

        // Check Leader Role IDs: "Đương Gia" (1438965974345842768) or "Đường Chủ" (1438966724082012290)
        canEditPermission =
          memberRoleIds.includes(ROLE_DUONG_GIA) ||
          memberRoleIds.includes(ROLE_DUONG_CHU);
      } catch (botErr) {
        if (botErr.response?.status === 404) {
          return res.status(403).json({
            success: false,
            message: 'Tài khoản Discord của bạn chưa gia nhập Server Discord Thiên Thư Môn!'
          });
        }
        console.warn('Bot API Member query warning:', botErr.response?.data || botErr.message);
      }
    } else {
      isBangChungMember = true;
      canEditPermission = true;
    }

    if (!isBangChungMember) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn chưa có Role ID Bang Chúng (1438967271149146302). Vui lòng liên hệ Ban Quản Trị để cấp Role trước khi đăng nhập!'
      });
    }

    // 4. Extract Server Nickname & Detect Class from Class Role IDs
    const nickname = guildMember?.nick || discordUser.global_name || discordUser.username;
    const finalClass = getClassFromRoles(memberRoleIds, nickname);

    // Avatar URL
    let avatarUrl = '';
    if (discordUser.avatar) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=256`;
    } else {
      const defaultAvatarIndex = (BigInt(discordUser.id) >> 22n) % 6n;
      avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
    }

    // Determine Primary Role (Đương Gia > Đường Chủ > Bang Chúng)
    let primaryRole = 'Bang Chúng';
    if (memberRoleIds.includes(ROLE_DUONG_GIA)) primaryRole = 'Đương Gia';
    else if (memberRoleIds.includes(ROLE_DUONG_CHU)) primaryRole = 'Đường Chủ';

    // Friendly Role Names list for UI
    let readableRoles = [];
    if (memberRoleIds.includes(ROLE_DUONG_GIA)) readableRoles.push('Đương Gia');
    if (memberRoleIds.includes(ROLE_DUONG_CHU)) readableRoles.push('Đường Chủ');
    if (memberRoleIds.includes(ROLE_BANG_CHUNG)) readableRoles.push('Bang Chúng');
    if (readableRoles.length === 0) readableRoles.push('Bang Chúng');

    // 5. Upsert User in MongoDB
    const dbUser = await User.findOneAndUpdate(
      { discordId: discordUser.id },
      {
        username: discordUser.username,
        globalName: discordUser.global_name || discordUser.username,
        nickname: nickname,
        avatar: avatarUrl,
        className: finalClass,
        primaryRole: primaryRole,
        roles: readableRoles,
        canEdit: canEditPermission,
        inGuild: true,
        lastLogin: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 6. Issue JWT Token
    const tokenPayload = {
      id: dbUser._id,
      discordId: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.global_name || discordUser.username,
      nickname: dbUser.nickname || nickname,
      avatar: avatarUrl,
      className: dbUser.className || finalClass,
      primaryRole: primaryRole,
      roles: readableRoles,
      canEdit: canEditPermission
    };

    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '7d' });

    return res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: tokenPayload
    });
  } catch (error) {
    console.error('Discord Auth Route Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống trong quá trình xác thực Discord.',
      error: error.message
    });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.user.discordId }).select('-__v');
    return res.json({
      success: true,
      user: user || req.user
    });
  } catch (err) {
    return res.json({
      success: true,
      user: req.user
    });
  }
});

/**
 * PUT /api/auth/class
 * Update current user's martial class (className)
 */
router.put('/class', authMiddleware, async (req, res) => {
  try {
    const { className } = req.body;
    if (!className) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin môn phái.' });
    }

    const updatedUser = await User.findOneAndUpdate(
      { discordId: req.user.discordId },
      { className },
      { new: true }
    ).select('-__v');

    return res.json({
      success: true,
      message: 'Cập nhật Môn Phái thành công!',
      user: updatedUser
    });
  } catch (err) {
    console.error('Lỗi cập nhật Môn Phái:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật môn phái.' });
  }
});

module.exports = router;
