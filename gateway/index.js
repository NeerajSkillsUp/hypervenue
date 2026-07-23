require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');

const app = express();

// Enable CORS for all incoming client connections
app.use(cors());

// Authentication Middleware to protect downstream routes
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-email'] = decoded.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// 1. Auth Service Proxy (Public access)
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/': '/api/v1/auth/' } // Rewrites /register -> /api/v1/auth/register
  })
);

// 2. Booking Service Proxy (Protected)
app.use(
  '/api/booking',
  verifyJWT,
  createProxyMiddleware({
    target: process.env.BOOKING_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/': '/api/v1/booking/' }
  })
);

// 3. Food Service Proxy (Protected)
app.use(
  '/api/food',
  verifyJWT,
  createProxyMiddleware({
    target: process.env.FOOD_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/': '/api/v1/food/' }
  })
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'API Gateway is healthy' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));