/**
 * Đồng bộ real-time sơ đồ đội hình (Socket.IO).
 * - Mỗi chiến kỳ (eventId) là một room.
 * - Ai đăng nhập cũng xem được; chỉ user có canEdit mới gửi được thao tác (ops).
 * - Trạng thái giữ trong RAM, ghi xuống Mongo có debounce.
 * - Presence (con trỏ chuột, ô đang sửa) chỉ chuyển tiếp, không lưu.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Lineup = require('../models/Lineup');

const PERSIST_DELAY_MS = 800;
const MAX_OPS_PER_MSG = 200;
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899'];

const rooms = new Map(); // eventId -> { doc, version, timer, saving, updatedBy }
let io = null;

const rid = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const clone = (v) => JSON.parse(JSON.stringify(v));
const colorFor = (id) => {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
};

function ensureIds(divisions) {
  let changed = false;
  divisions.forEach((d) => {
    if (!d.id) { d.id = rid('div'); changed = true; }
    (d.teams || []).forEach((t) => {
      if (!t.id) { t.id = rid('team'); changed = true; }
    });
  });
  return changed;
}

// ---- Áp dụng op (giữ đồng bộ với client: src/utils/lineupOps.js) ----
// isCollapsed là trạng thái giao diện riêng từng người nên không đồng bộ.
const stripUi = (o) => { const { isCollapsed, ...rest } = o; return rest; };

function applyOp(doc, op) {
  const divs = doc.divisions;
  switch (op.t) {
    case 'title':
      if (typeof op.v !== 'string' || op.v.length > 200) return false;
      doc.title = op.v;
      return true;
    case 'divisions':
      if (!Array.isArray(op.v)) return false;
      doc.divisions = op.v.map(stripUi);
      return true;
    case 'div': {
      const d = divs.find((x) => x.id === op.div);
      if (!d || !op.v || typeof op.v !== 'object') return false;
      const teams = d.teams;
      Object.keys(d).forEach((k) => { if (k !== 'teams' && k !== 'isCollapsed' && k !== 'id') delete d[k]; });
      Object.assign(d, stripUi(op.v), { id: d.id, teams });
      return true;
    }
    case 'teams': {
      const d = divs.find((x) => x.id === op.div);
      if (!d || !Array.isArray(op.v)) return false;
      d.teams = op.v;
      return true;
    }
    case 'team': {
      const d = divs.find((x) => x.id === op.div);
      const t = d && d.teams.find((x) => x.id === op.team);
      if (!t || !op.v || typeof op.v !== 'object') return false;
      const slots = t.slots;
      Object.keys(t).forEach((k) => { if (k !== 'slots' && k !== 'id') delete t[k]; });
      Object.assign(t, op.v, { id: t.id, slots });
      return true;
    }
    case 'slot': {
      const d = divs.find((x) => x.id === op.div);
      const t = d && d.teams.find((x) => x.id === op.team);
      if (!t || !Number.isInteger(op.si) || op.si < 0 || !t.slots || op.si >= t.slots.length) return false;
      if (!op.v || typeof op.v !== 'object') return false;
      t.slots[op.si] = op.v;
      return true;
    }
    default:
      return false;
  }
}

// ---- Phòng / lưu trữ ----
async function getRoom(eventId) {
  let room = rooms.get(eventId);
  if (room) return room;
  const saved = await Lineup.findOne({ eventId }).lean();
  room = {
    doc: {
      title: (saved && saved.title) || 'ĐỘI HÌNH BANG CHIẾN',
      divisions: saved && Array.isArray(saved.divisions) ? clone(saved.divisions) : [],
    },
    version: 1,
    timer: null,
    updatedBy: saved && saved.updatedBy,
    hasSaved: !!saved,
  };
  if (ensureIds(room.doc.divisions) && saved) schedulePersist(eventId, room);
  // nếu có socket khác đã tạo room trong lúc await
  if (rooms.has(eventId)) return rooms.get(eventId);
  rooms.set(eventId, room);
  return room;
}

function schedulePersist(eventId, room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(() => persist(eventId).catch((e) => console.error('[lineupRealtime] persist lỗi:', e.message)), PERSIST_DELAY_MS);
}

async function persist(eventId) {
  const room = rooms.get(eventId);
  if (!room) return;
  if (room.timer) { clearTimeout(room.timer); room.timer = null; }
  await Lineup.findOneAndUpdate(
    { eventId },
    { title: room.doc.title, divisions: room.doc.divisions, updatedBy: room.updatedBy, updatedAt: Date.now() },
    { upsert: true }
  );
  room.hasSaved = true;
}

function peersOf(eventId) {
  const list = [];
  const sockets = io.sockets.adapter.rooms.get(`lineup:${eventId}`);
  if (!sockets) return list;
  sockets.forEach((sid) => {
    const s = io.sockets.sockets.get(sid);
    if (s && s.data.peer) list.push(s.data.peer);
  });
  return list;
}

function dropRoomIfEmpty(eventId) {
  const sockets = io.sockets.adapter.rooms.get(`lineup:${eventId}`);
  if (sockets && sockets.size > 0) return;
  const room = rooms.get(eventId);
  if (!room) return;
  persist(eventId)
    .catch((e) => console.error('[lineupRealtime] persist lỗi:', e.message))
    .finally(() => {
      const again = io.sockets.adapter.rooms.get(`lineup:${eventId}`);
      if (!again || again.size === 0) rooms.delete(eventId);
    });
}

function leaveCurrent(socket) {
  const eventId = socket.data.eventId;
  if (!eventId) return;
  socket.leave(`lineup:${eventId}`);
  socket.data.eventId = null;
  io.to(`lineup:${eventId}`).emit('presence:leave', { id: socket.id });
  dropRoomIfEmpty(eventId);
}

function init(httpServer, allowedOrigins = []) {
  io = new Server(httpServer, {
    cors: allowedOrigins.length ? { origin: allowedOrigins } : { origin: true },
    maxHttpBufferSize: 2e6,
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('unauthorized'));
      socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch (e) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const u = socket.data.user;
    const userKey = u.discordId || u.userId || u.id || u.username;
    socket.data.peer = {
      id: socket.id,
      userId: String(userKey),
      name: u.nickname || u.username || 'Ẩn danh',
      avatar: u.avatar || '',
      color: colorFor(userKey),
      canEdit: !!u.canEdit,
      focus: null,
    };

    socket.on('lineup:join', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const eventId = payload && typeof payload.eventId === 'string' ? payload.eventId : '';
        if (!eventId || eventId.length > 100) return reply({ ok: false });
        leaveCurrent(socket);
        const room = await getRoom(eventId);
        socket.data.eventId = eventId;
        socket.data.peer.focus = null;
        socket.join(`lineup:${eventId}`);
        socket.to(`lineup:${eventId}`).emit('presence:join', socket.data.peer);
        reply({
          ok: true,
          me: socket.data.peer,
          state: { title: room.doc.title, divisions: room.doc.divisions, version: room.version, hasSaved: room.hasSaved },
          peers: peersOf(eventId).filter((p) => p.id !== socket.id),
        });
      } catch (e) {
        console.error('[lineupRealtime] join lỗi:', e.message);
        reply({ ok: false });
      }
    });

    socket.on('lineup:leave', () => leaveCurrent(socket));

    socket.on('lineup:ops', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const eventId = socket.data.eventId;
      if (!eventId) return reply({ ok: false });
      if (!socket.data.user.canEdit) return reply({ ok: false, error: 'forbidden' });
      const ops = payload && Array.isArray(payload.ops) ? payload.ops : null;
      if (!ops || ops.length === 0 || ops.length > MAX_OPS_PER_MSG) return reply({ ok: false });

      const room = rooms.get(eventId);
      if (!room) return reply({ ok: false });

      const applied = [];
      let failed = false;
      for (const op of ops) {
        if (op && applyOp(room.doc, op)) applied.push(op);
        else failed = true;
      }
      if (applied.length) {
        if (ensureIds(room.doc.divisions)) failed = true; // client gửi thiếu id -> ép đồng bộ lại
        room.version += 1;
        room.updatedBy = socket.data.peer.name;
        schedulePersist(eventId, room);
        socket.to(`lineup:${eventId}`).emit('lineup:ops', { ops: applied, version: room.version, by: socket.id });
      }
      if (failed) {
        // có op không áp dụng được (lệch cấu trúc): gửi lại trạng thái chuẩn cho người gửi
        socket.emit('lineup:state', { title: room.doc.title, divisions: room.doc.divisions, version: room.version });
      }
      reply({ ok: true, version: room.version });
    });

    socket.on('presence:cursor', (pos) => {
      const eventId = socket.data.eventId;
      if (!eventId) return;
      const p = pos && typeof pos.x === 'number' && typeof pos.y === 'number' ? { x: pos.x, y: pos.y } : null;
      socket.volatile.to(`lineup:${eventId}`).emit('presence:cursor', { id: socket.id, pos: p });
    });

    socket.on('presence:focus', (key) => {
      const eventId = socket.data.eventId;
      if (!eventId) return;
      const f = typeof key === 'string' && key.length < 200 ? key : null;
      socket.data.peer.focus = f;
      socket.to(`lineup:${eventId}`).emit('presence:focus', { id: socket.id, key: f });
    });

    socket.on('disconnect', () => leaveCurrent(socket));
  });

  return io;
}

/** Gọi khi lưu qua REST: cập nhật RAM và phát lại cho mọi người trong phòng. */
async function replaceState(eventId, lineup) {
  if (!io) return;
  const room = rooms.get(eventId);
  if (!room) return;
  room.doc = {
    title: lineup.title || room.doc.title,
    divisions: clone(lineup.divisions || []),
  };
  ensureIds(room.doc.divisions);
  room.version += 1;
  if (room.timer) { clearTimeout(room.timer); room.timer = null; }
  io.to(`lineup:${eventId}`).emit('lineup:state', { title: room.doc.title, divisions: room.doc.divisions, version: room.version });
}

/** Ghi ngay xuống DB trước khi đọc (vd. gửi thông báo Discord). */
async function flush(eventId) {
  if (rooms.has(eventId)) await persist(eventId);
}

module.exports = { init, replaceState, flush, applyOp };
