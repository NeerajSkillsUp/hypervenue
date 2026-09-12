require('dotenv').config();
const crypto = require('crypto');
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
  const { email, phoneNumber, password, role, businessName } = req.body;
  if (role === 'staff') {
    return res.status(403).json({
      error: 'Staff accounts cannot be self-registered'
    });
  }
  const assignedRole = ['customer', 'vendor'].includes(role) ? role : 'customer';

  if (!email || !phoneNumber || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (assignedRole === 'vendor' && !businessName) {
    return res.status(400).json({ error: 'businessName is required for vendor accounts' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, phone_number, password_hash, role, business_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, phone_number, role`,
      [email, phoneNumber, passwordHash, assignedRole, assignedRole === 'vendor' ? businessName : null]
    );

    const user = result.rows[0];

    const otp = crypto.randomInt(100000, 1000000).toString();
    await redis.set(`otp:${email}`, otp, 'EX', 300);

    console.log(`[DEMO ONLY] OTP for ${email} is: ${otp}`);

    return res.status(201).json({
      message: 'User registered successfully. Verify OTP to complete registration.',
      user: { id: user.id, email: user.email, role: user.role },
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

// Fire-and-report vendor provisioning call. Never blocks or fails OTP
// verification — food-service's self-heal fallback covers us if this
// doesn't land (service down, timeout, network blip).
async function provisionVendorIfNeeded(user) {
  if (user.role !== 'vendor') return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(`${process.env.FOOD_SERVICE_URL}/api/v1/food/internal/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET
      },
      body: JSON.stringify({ ownerUserId: user.id, name: user.business_name }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      console.error(`[VENDOR PROVISION] food-service responded ${resp.status} for user ${user.id}`);
    } else {
      console.log(`[VENDOR PROVISION] Vendor created for user ${user.id}`);
    }
  } catch (err) {
    console.error(`[VENDOR PROVISION] Failed to reach food-service for user ${user.id}:`, err.message);
    // Deliberately not re-thrown — see self-heal fallback in food-service.
  }
}

// 2. VERIFY OTP ENDPOINT
app.post('/api/v1/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const storedOtp = await redis.get(`otp:${email}`);

    if (!storedOtp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    if (storedOtp !== otp) {
      const attemptsKey = `otp_attempts:${email}`;
      const attempts = await redis.incr(attemptsKey);

      if (attempts === 1) {
        await redis.expire(attemptsKey, 300);
      }

      if (attempts >= 5) {
        await redis.del(`otp:${email}`);
        await redis.del(attemptsKey);
        return res.status(429).json({
          error: 'Too many invalid OTP attempts. Please register again.'
        });
      }

      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const result = await pool.query(
      'UPDATE users SET is_verified = TRUE WHERE email = $1 RETURNING id, role, business_name',
      [email]
    );

    await redis.del(`otp:${email}`);
    await redis.del(`otp_attempts:${email}`);

    provisionVendorIfNeeded(result.rows[0]); // not awaited — don't hold up the response

    return res.json({ message: 'Account verified successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. LOGIN ENDPOINT — put role in the JWT payload and the response
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

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.json({
      message: 'Login successful',
      accessToken,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));