require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Redis = require('ioredis');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// Database Connections
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);

// 1. REGISTER ENDPOINT
app.post('/api/v1/auth/register', async (req, res) => {
  const { email, phoneNumber, password } = req.body;

  if (!email || !phoneNumber || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, phone_number, password_hash) VALUES ($1, $2, $3) RETURNING id, email, phone_number`,
      [email, phoneNumber, passwordHash]
    );

    const user = result.rows[0];

    // Generate 6-digit OTP & store in Redis (5 min TTL)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redis.set(`otp:${email}`, otp, 'EX', 300);

    console.log(`[DEMO ONLY] OTP for ${email} is: ${otp}`);

    return res.status(201).json({
      message: 'User registered successfully. Verify OTP to complete registration.',
      user: { id: user.id, email: user.email },
      debugOtp: otp
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email or phone number already exists' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. VERIFY OTP ENDPOINT
app.post('/api/v1/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const storedOtp = await redis.get(`otp:${email}`);

    if (!storedOtp || storedOtp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    await pool.query('UPDATE users SET is_verified = TRUE WHERE email = $1', [email]);
    await redis.del(`otp:${email}`);

    return res.json({ message: 'Account verified successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. LOGIN ENDPOINT
app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Please verify your OTP first' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 🔑 Generates token valid for 8 hours (configured via .env)
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.json({
      message: 'Login successful',
      accessToken,
      user: { id: user.id, email: user.email }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));