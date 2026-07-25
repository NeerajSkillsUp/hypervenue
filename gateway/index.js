require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');

const app = express();

// Enable CORS for frontend requests
app.use(cors());

// JWT Verification Middleware for protected routes
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production');
    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-email'] = decoded.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// 1. Auth Service Proxy
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:4001',
    changeOrigin: true,
    pathRewrite: {
      '^/': '/api/v1/auth/' // Converts '/register' -> '/api/v1/auth/register'
    },
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
    // Normalize trailing slashes so '/checkin' and '/checkin/' match the same way
    const path = req.path.replace(/\/+$/, '') || '/';

    // "My tickets" needs to know WHO is asking, so it always requires a JWT
    // even though it's a GET request.
    if (path === '/my-tickets') {
      return verifyJWT(req, res, next);
    }

    // The gate scanner is operated by venue staff scanning an attendee's QR
    // code — it is NOT the ticket buyer's authenticated browser session, so
    // it must never require the buyer's JWT. Ticket validity is enforced by
    // the booking-service itself (valid UUID, paid, not already checked in).
    if (req.method === 'POST' && path === '/checkin') {
      return next();
    }

    // Public GET requests (seat map, single ticket lookup) don't require JWT.
    if (req.method === 'GET') {
      return next();
    }

    // All other operations (lock seat, checkout, confirm-dev) require JWT.
    return verifyJWT(req, res, next);
  },
  createProxyMiddleware({
    target: process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:4002',
    changeOrigin: true,
    pathRewrite: {
      '^/': '/api/v1/booking/' // Rewrites /api/booking/* to /api/v1/booking/*
    }
  })
);

// 3. Food Service Proxy
app.use(
  '/api/food',
  verifyJWT,
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