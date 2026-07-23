require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Redis = require('ioredis');

const app = express();
app.use(cors());

// Handle raw body for Stripe webhooks vs JSON for standard endpoints
app.use((req, res, next) => {
  if (req.originalUrl === '/api/v1/booking/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);

// -------------------------------------------------------------
// Periodic Background Cleanup Job: Release expired seat locks
// -------------------------------------------------------------
setInterval(async () => {
  try {
    const result = await pool.query(
      `UPDATE seats 
       SET status = 'AVAILABLE', locked_at = NULL 
       WHERE status = 'LOCKED' AND locked_at < NOW() - INTERVAL '5 minutes'`
    );
    if (result.rowCount > 0) {
      console.log(`[CLEANUP] Released ${result.rowCount} expired seat locks`);
    }
  } catch (err) {
    console.error('[CLEANUP ERROR]', err);
  }
}, 30000); // Runs every 30 seconds

// 1. GET ALL SEATS FOR AN EVENT
app.get('/api/v1/booking/events/:eventId/seats', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, seat_number, price_cents, status FROM seats WHERE event_id = $1 ORDER BY seat_number ASC',
      [req.params.eventId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. ATOMIC SEAT LOCK (Prevents Double Booking using SELECT ... FOR UPDATE)
app.post('/api/v1/booking/lock', async (req, res) => {
  const { seatId } = req.body;
  const userId = req.headers['x-user-id'] || 'test-user-id'; // Injected by Gateway

  if (!seatId) {
    return res.status(400).json({ error: 'seatId is required' });
  }

  // Reserve a dedicated connection client from pool for atomic transaction
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Row-level exclusive lock on the selected seat
    const seatResult = await client.query(
      'SELECT id, status FROM seats WHERE id = $1 FOR UPDATE',
      [seatId]
    );

    if (seatResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Seat not found' });
    }

    const seat = seatResult.rows[0];

    if (seat.status !== 'AVAILABLE') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Seat is no longer available or already locked' });
    }

    // Update seat status to LOCKED with timestamp
    await client.query(
      "UPDATE seats SET status = 'LOCKED', locked_at = NOW() WHERE id = $1",
      [seatId]
    );

    await client.query('COMMIT');

    // Set Redis key with 5-minute TTL (300s)
    await redis.set(`seat_hold:${seatId}`, userId, 'EX', 300);

    return res.json({
      message: 'Seat locked successfully for 5 minutes',
      seatId,
      expiresInSeconds: 300
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release(); // Always release connection back to the pool
  }
});

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => console.log(`Booking Service running on port ${PORT}`));