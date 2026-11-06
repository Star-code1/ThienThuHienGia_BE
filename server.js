
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const connectDB = require('./config/db');



// Load env
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('Thiếu biến môi trường JWT_SECRET, dừng server.');
  process.exit(1);
}

// Connect Database
connectDB();

const app = express();
app.set('trust proxy', 1); // sau reverse proxy (Render) để rate-limit nhận đúng IP

const rateLimit = require('express-rate-limit');
const limiter = (max, windowMs = 60 * 1000) =>
  rateLimit({ windowMs, limit: max, standardHeaders: true, legacyHeaders: false,
    message: { success: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' } });

// Middleware
app.use(compression());
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));
const bigJson = express.json({ limit: '50mb' });
app.use(['/api/skills', '/api/match-analysis'], bigJson);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Rate limit: chung 300 req/phút/IP, đăng nhập chặt hơn
app.use('/api', limiter(300));
app.use('/api/auth/discord', limiter(10));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/guild', require('./routes/guildRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/lineup', require('./routes/lineupRoutes'));
app.use('/api/skills', require('./routes/skillRoutes'));
app.use('/api/match-analysis', require('./routes/matchAnalysisRoutes'));

// Root Healthcheck
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/', (req, res) => {
  res.send('API Lineup Discord Bot is running...');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});