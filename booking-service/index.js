require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Redis = require('ioredis');
const QRCode = require('qrcode');
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
}, 30000);

// 1. GET ALL SEATS FOR AN EVENT
app.get(
  [
    '/events/:eventId/seats',
    '/api/booking/events/:eventId/seats',
    '/api/v1/booking/events/:eventId/seats'
  ], 
  async (req, res) => {
    const { eventId } = req.params;
    try {
      const result = await pool.query(
        'SELECT * FROM seats WHERE event_id::text = $1 OR event_id::text LIKE $2 ORDER BY seat_number ASC',
        [eventId, `%${eventId}%`]
      );
      res.json(result.rows);
    } catch (err) {
      console.error('Database Query Error:', err);
      res.status(500).json({ error: 'Database query failed' });
    }
  }
);

// 2. FETCH TICKET DETAILS (Updated with all route aliases)
app.get(
  [
    '/tickets/:bookingId', 
    '/api/booking/tickets/:bookingId',
    '/api/v1/booking/tickets/:bookingId'
  ], 
  async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.bookingId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('Ticket fetch error:', err);
      return res.status(500).json({ error: 'Failed to fetch ticket' });
    }
  }
);

// 3. GATE SCANNER CHECK-IN
app.post(['/checkin', '/api/booking/checkin', '/api/v1/booking/checkin'], async (req, res) => {
  const { bookingId } = req.body;

  if (!bookingId) {
    return res.status(400).json({ error: 'bookingId is required' });
  }

  try {
    const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
    const booking = result.rows[0];

    if (!booking) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    if (booking.payment_status !== 'COMPLETED') {
      return res.status(403).json({ error: 'Ticket was never paid for' });
    }
    if (booking.checked_in) {
      return res.status(409).json({
        error: 'Ticket already used',
        checkedInAt: booking.checked_in_at
      });
    }

    await pool.query(
      'UPDATE bookings SET checked_in = TRUE, checked_in_at = NOW() WHERE id = $1',
      [bookingId]
    );

    return res.json({ message: 'Entry granted', seatId: booking.seat_id });
  } catch (err) {
    console.error('Checkin error:', err);
    return res.status(500).json({ error: 'Check-in failed' });
  }
});

// 4. ATOMIC SEAT LOCK
app.post(
  ['/lock', '/api/booking/lock', '/api/v1/booking/lock'], 
  async (req, res) => {
    const { seatId } = req.body;
    const userId = req.headers['x-user-id'] || 'test-user-id';

    if (!seatId) {
      return res.status(400).json({ error: 'seatId is required' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

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

      await client.query(
        "UPDATE seats SET status = 'LOCKED', locked_at = NOW() WHERE id = $1",
        [seatId]
      );

      await client.query('COMMIT');

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
      client.release();
    }
  }
);

// 5. PAYMENT CHECKOUT ENDPOINT (Fixed Idempotency)
app.post(['/checkout', '/api/booking/checkout', '/api/v1/booking/checkout'], async (req, res) => {
  const { seatId, idempotencyKey } = req.body;
  const userId = req.headers['x-user-id'] || 'demo-user-123';

  if (!seatId || !idempotencyKey) {
    return res.status(400).json({ error: 'seatId and idempotencyKey are required' });
  }

  try {
    const seatResult = await pool.query('SELECT price_cents FROM seats WHERE id = $1', [seatId]);
    if (seatResult.rows.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }

    const { price_cents } = seatResult.rows[0];
    let booking;

    try {
      // Create pending booking row in database
      const bookingResult = await pool.query(
        'INSERT INTO bookings (user_id, seat_id, idempotency_key) VALUES ($1, $2, $3) RETURNING *',
        [userId, seatId, idempotencyKey]
      );
      booking = bookingResult.rows[0];
    } catch (dbErr) {
      // Handles duplicate submission/React StrictMode double invocation (code 23505)
      if (dbErr.code === '23505') {
        const existing = await pool.query('SELECT * FROM bookings WHERE idempotency_key = $1', [idempotencyKey]);
        if (existing.rows.length > 0) {
          booking = existing.rows[0];
        } else {
          throw dbErr;
        }
      } else {
        throw dbErr;
      }
    }

    // Always create Stripe PaymentIntent and return clientSecret
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price_cents,
      currency: 'usd',
      metadata: {
        bookingId: booking.id,
        seatId: seatId,
        userId: userId
      }
    });

    return res.status(201).json({
      bookingId: booking.id,
      clientSecret: paymentIntent.client_secret
    });
  } catch (err) {
    console.error('Checkout backend error:', err);
    return res.status(500).json({ error: 'Checkout session creation failed' });
  }
});

// 6. DIRECT DEV CONFIRMATION ENDPOINT (Local Development Fallback)
app.post(
  ['/confirm-dev', '/api/booking/confirm-dev', '/api/v1/booking/confirm-dev'],
  async (req, res) => {
    const { bookingId, seatId } = req.body;

    if (!bookingId || !seatId) {
      return res.status(400).json({ error: 'bookingId and seatId are required' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Generate QR Code payload
      const qrPayload = JSON.stringify({ bookingId, seatId, ts: Date.now() });
      const qrDataUrl = await QRCode.toDataURL(qrPayload);

      // 2. Mark booking COMPLETED & save QR code
      await client.query(
        `UPDATE bookings SET payment_status = 'COMPLETED', qr_code_payload = $1 WHERE id = $2`,
        [qrDataUrl, bookingId]
      );

      // 3. Mark seat permanently BOOKED
      await client.query(`UPDATE seats SET status = 'BOOKED' WHERE id = $1`, [seatId]);

      await client.query('COMMIT');

      // 4. Clear temporary Redis lock
      if (redis) {
        await redis.del(`seat_hold:${seatId}`);
      }

      console.log(`✅ [DEV CONFIRM] Booking ${bookingId} completed & seat ${seatId} booked!`);
      return res.json({ success: true, message: 'Booking confirmed via dev endpoint' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Dev confirmation error:', err);
      return res.status(500).json({ error: 'Failed to confirm booking locally' });
    } finally {
      client.release();
    }
  }
);

// 7. STRIPE WEBHOOK
app.post(
  '/api/v1/booking/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const { bookingId, seatId } = event.data.object.metadata;
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Generate QR Code payload
        const qrPayload = JSON.stringify({ bookingId, seatId, ts: Date.now() });
        const qrDataUrl = await QRCode.toDataURL(qrPayload);

        // Mark booking COMPLETED & save QR code
        await client.query(
          `UPDATE bookings SET payment_status = 'COMPLETED', qr_code_payload = $1 WHERE id = $2`,
          [qrDataUrl, bookingId]
        );

        // Mark seat permanently BOOKED
        await client.query(`UPDATE seats SET status = 'BOOKED' WHERE id = $1`, [seatId]);

        await client.query('COMMIT');

        // Clear temporary Redis lock
        if (redis) {
          await redis.del(`seat_hold:${seatId}`);
        }
        console.log(`✅ Booking ${bookingId} completed & seat ${seatId} booked!`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Webhook DB update failed:', err);
      } finally {
        client.release();
      }
    }

    res.json({ received: true });
  }
);

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => console.log(`Booking Service running on port ${PORT}`));