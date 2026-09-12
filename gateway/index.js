require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();

const allowedOrigin = process.env.CLIENT_URL;

app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));

// Protects Auth's login/register endpoints from brute-forcing
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a minute.' }
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-email'] = decoded.email;
    req.headers['x-user-role'] = decoded.role || 'customer'; // NEW
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// 1. Auth Service Proxy — rate limited before it ever hits Auth
app.use(
  '/api/auth',
  authLimiter,
  createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:4001',
    changeOrigin: true,
    pathRewrite: { '^/': '/api/v1/auth/' },
    onProxyReq: (proxyReq, req) => {
      console.log(`[GATEWAY PROXY] ${req.method} ${req.originalUrl} -> ${process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:4001'}${proxyReq.path}`);
    },
    onError: (err, req, res) => {
      console.error('[GATEWAY ERROR] Auth Service unavailable:', err.message);
      res.status(503).json({ error: 'Auth service is unreachable. Ensure port 4001 is running.' });
    }
  })
);

// 2. Booking Service Proxy
app.use(
  '/api/booking',
  (req, res, next) => {
    const path = req.path.replace(/\/+$/, '') || '/';

    // Seat availability is intentionally public.
    // The actual booking/locking operations remain protected.
    if (req.method === 'GET' && path.includes('/events/') && path.endsWith('/seats')) {
      return next();
    }

    // Every other Booking GET requires authentication.
    if (req.method === 'GET') {
      return verifyJWT(req, res, next);
    }

    // Check-in is a staff-only operation.
    if (req.method === 'POST' && path === '/checkin') {
      return verifyJWT(req, res, () => {
        if (req.headers['x-user-role'] !== 'staff') {
          return res.status(403).json({
            error: 'Staff access required'
          });
        }

        next();
      });
    }

    // All other Booking write operations require authentication.
    return verifyJWT(req, res, next);
  },
  createProxyMiddleware({
    target: process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:4002',
    changeOrigin: true,
    pathRewrite: {
      '^/': '/api/v1/booking/'
    }
  })
);

app.use('/api/food/internal', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 3. Food Service Proxy
app.use(
  '/api/food',
  (req, res, next) => {
    // Public food menu
    if (req.method === 'GET' && req.path === '/menu') {
      return next();
    }

    // All other Food Service routes require authentication
    return verifyJWT(req, res, next);
  },
  createProxyMiddleware({
    target: process.env.FOOD_SERVICE_URL || 'http://127.0.0.1:4003',
    changeOrigin: true,
    pathRewrite: { '^/': '/api/v1/food/' }
  })
);

app.get('/health', (req, res) => {
  res.json({ status: 'API Gateway is healthy' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));