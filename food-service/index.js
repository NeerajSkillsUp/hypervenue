require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const Stripe = require('stripe');

// Initialize Stripe with key from process.env
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey || stripeKey === 'sk_test_mock') {
  console.warn('⚠️ WARNING: STRIPE_SECRET_KEY is missing or set to mock in .env!');
}
const stripe = new Stripe(stripeKey || 'sk_test_mock');

const app = express();
app.use(cors());

// Handle raw body for Stripe webhook vs JSON for standard routes
app.use((req, res, next) => {
  if (req.originalUrl === '/api/v1/food/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH'] }
});

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hypervenue_food')
  .then(() => console.log('Connected to Food MongoDB'))
  .catch(err => console.error('Mongo connection error:', err));

// --- Schemas ---
const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerUserId: { type: String, required: true },
  isActive: { type: Boolean, default: true }
});
const Vendor = mongoose.model('Vendor', vendorSchema);

const menuItemSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', index: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  priceCents: { type: Number, required: true },
  isAvailable: { type: Boolean, default: true }
});
const MenuItem = mongoose.model('MenuItem', menuItemSchema);

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  seatNumber: { type: String, required: true, uppercase: true, trim: true },
  items: [{ menuItemId: mongoose.Schema.Types.ObjectId, name: String, quantity: Number, priceCents: Number }],
  totalAmountCents: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },
  paymentIntentId: { type: String, default: null },
  status: {
    type: String,
    enum: ['RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'],
    default: 'RECEIVED'
  },
  runnerId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// Shared vendor lookup/self-heal helper. Used by the vendor-orders route and
// the new vendor menu-management routes below, so both stay in sync about
// what "this vendor account" means and neither hard-fails a legitimate
// vendor-role user who is missing a Vendor doc for some historical reason.
async function getOrCreateVendor(ownerUserId, role) {
  let vendor = await Vendor.findOne({ ownerUserId });
  if (!vendor && role === 'vendor') {
    vendor = await Vendor.create({ ownerUserId, name: 'Unnamed Stand', isActive: true });
    console.log(`[SELF-HEAL] Created missing Vendor doc for user ${ownerUserId}`);
  }
  return vendor;
}

// --- Authenticated Sockets & Per-Seat Rooms ---
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('unauthorized'));
    
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey');
    socket.userId = payload.userId;
    next();
  } catch (err) {
    next(new Error('unauthorized'));
  }
});

// --- Authenticated Sockets & Per-Seat / Per-Vendor Rooms ---
io.on('connection', (socket) => {
  console.log(`Socket client connected: ${socket.id} (User: ${socket.userId})`);

  socket.on('joinSeatRoom', ({ seatNumber }) => {
    if (seatNumber) {
      const room = `seat:${seatNumber.toUpperCase().trim()}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    }
  });

  // Renamed from the old generic 'kitchen' room to a room keyed on the
  // vendor account so one vendor's dashboard never sees another vendor's
  // live updates. Matches VendorDashboard.jsx's emit('joinVendorRoom').
  socket.on('joinVendorRoom', async () => {
    try {
      const vendor = await Vendor.findOne({ ownerUserId: socket.userId });
      if (!vendor) return;
      socket.join(`vendor:${vendor._id}`);
      console.log(`Socket ${socket.id} joined room vendor:${vendor._id}`);
    } catch (err) {
      console.error('joinVendorRoom error:', err);
    }
  });
});

// 1. Fetch Menu Items
app.get(['/menu', '/api/food/menu', '/api/v1/food/menu'], async (req, res) => {
  try {
    const items = await MenuItem.find({ isAvailable: true });
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// 2. Fetch Kitchen Active Orders (Only paid/completed orders)
app.get(['/kitchen/orders', '/api/food/kitchen/orders', '/api/v1/food/kitchen/orders'], async (req, res) => {
  try {
    const orders = await Order.find({ paymentStatus: 'COMPLETED' }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch kitchen orders' });
  }
});

app.get(['/orders/seat/:seatNumber', '/api/food/orders/seat/:seatNumber', '/api/v1/food/orders/seat/:seatNumber'], async (req, res) => {
  try {
    const seatNumber = req.params.seatNumber.toUpperCase().trim();
    const orders = await Order.find({ seatNumber, paymentStatus: 'COMPLETED' }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    console.error('Fetch seat orders error:', err);
    return res.status(500).json({ error: 'Failed to fetch seat orders' });
  }
});

// Vendor-scoped orders — matches "who is this vendor account?" via x-user-id
app.get(['/orders/vendor/my-orders', '/api/food/orders/vendor/my-orders', '/api/v1/food/orders/vendor/my-orders'], async (req, res) => {
  const ownerUserId = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];

  if (!ownerUserId) {
    return res.status(401).json({ error: 'Missing x-user-id' });
  }

  try {
    let vendor = await Vendor.findOne({ ownerUserId });

    // Self-heal: this account is vendor-role but somehow has no Vendor doc yet
    // (auth-service's internal call failed, food-service was down at signup
    // time, this is an account that was promoted to vendor manually, etc).
    // Create it lazily on first dashboard visit instead of hard-failing.
    if (!vendor && role === 'vendor') {
      vendor = await Vendor.create({ ownerUserId, name: 'Unnamed Stand', isActive: true });
      console.log(`[SELF-HEAL] Created missing Vendor doc for user ${ownerUserId}`);
    }

    if (!vendor) {
      return res.status(404).json({ error: 'No vendor account found for this user' });
    }

    const orders = await Order.find({ vendorId: vendor._id, paymentStatus: 'COMPLETED' }).sort({ createdAt: -1 });
    return res.json({ vendorId: vendor._id, vendorName: vendor.name, orders });
  } catch (err) {
    console.error('Vendor orders fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch vendor orders' });
  }
});

// --- Vendor Menu Management (owner-only CRUD) ---
// Every route below requires the caller to be an authenticated vendor-role
// user, and every write is scoped to *that* vendor's own MenuItem docs —
// a vendor can never read or modify another stand's menu.
const requireVendorOwnership = async (req, res, next) => {
  const ownerUserId = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];

  if (!ownerUserId) {
    return res.status(401).json({ error: 'Missing x-user-id' });
  }
  if (role !== 'vendor') {
    return res.status(403).json({ error: 'Vendor account required' });
  }

  try {
    const vendor = await getOrCreateVendor(ownerUserId, role);
    if (!vendor) {
      return res.status(404).json({ error: 'No vendor account found for this user' });
    }
    req.vendor = vendor;
    next();
  } catch (err) {
    console.error('Vendor ownership check failed:', err);
    // Include the real Mongoose/Mongo error message (name + message only,
    // never the stack) so a failure is self-diagnosing from the UI alone —
    // this is a dev-scale internal tool, not a public-facing endpoint.
    return res.status(500).json({ error: `Failed to resolve vendor account: ${err.name}: ${err.message}` });
  }
};

// GET the vendor's full menu — including unavailable items, since the
// vendor needs to see (and re-enable) items the public /menu endpoint hides.
app.get(
  ['/vendor/menu', '/api/food/vendor/menu', '/api/v1/food/vendor/menu'],
  requireVendorOwnership,
  async (req, res) => {
    try {
      const items = await MenuItem.find({ vendorId: req.vendor._id }).sort({ category: 1, name: 1 });
      return res.json({ vendorId: req.vendor._id, vendorName: req.vendor.name, items });
    } catch (err) {
      console.error('Vendor menu fetch error:', err);
      return res.status(500).json({ error: `Failed to fetch menu: ${err.name}: ${err.message}` });
    }
  }
);

// CREATE a menu item
app.post(
  ['/vendor/menu', '/api/food/vendor/menu', '/api/v1/food/vendor/menu'],
  requireVendorOwnership,
  async (req, res) => {
    const { name, category, priceCents } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'name and category are required' });
    }
    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      // Money is stored as integer cents throughout HyperVenue — never accept
      // a decimal dollar amount here, or totals will drift on the food side
      // the same way the guide warns about for booking prices.
      return res.status(400).json({ error: 'priceCents must be a positive integer (cents, not dollars)' });
    }

    try {
      const item = await MenuItem.create({
        vendorId: req.vendor._id,
        name,
        category,
        priceCents,
        isAvailable: true
      });
      return res.status(201).json(item);
    } catch (err) {
      console.error('Menu item creation error:', err);
      return res.status(500).json({ error: `Failed to create menu item: ${err.name}: ${err.message}` });
    }
  }
);

// UPDATE a menu item (name/category/price and/or availability toggle)
app.patch(
  ['/vendor/menu/:itemId', '/api/food/vendor/menu/:itemId', '/api/v1/food/vendor/menu/:itemId'],
  requireVendorOwnership,
  async (req, res) => {
    const { name, category, priceCents, isAvailable } = req.body;

    try {
      const item = await MenuItem.findById(req.params.itemId);
      if (!item) return res.status(404).json({ error: 'Menu item not found' });

      if (String(item.vendorId) !== String(req.vendor._id)) {
        return res.status(403).json({ error: 'You do not own this menu item' });
      }

      if (name !== undefined) item.name = name;
      if (category !== undefined) item.category = category;
      if (priceCents !== undefined) {
        if (!Number.isInteger(priceCents) || priceCents <= 0) {
          return res.status(400).json({ error: 'priceCents must be a positive integer' });
        }
        item.priceCents = priceCents;
      }
      if (isAvailable !== undefined) item.isAvailable = !!isAvailable;

      await item.save();
      return res.json(item);
    } catch (err) {
      console.error('Menu item update error:', err);
      return res.status(500).json({ error: `Failed to update menu item: ${err.name}: ${err.message}` });
    }
  }
);

// DELETE a menu item
app.delete(
  ['/vendor/menu/:itemId', '/api/food/vendor/menu/:itemId', '/api/v1/food/vendor/menu/:itemId'],
  requireVendorOwnership,
  async (req, res) => {
    try {
      const item = await MenuItem.findById(req.params.itemId);
      if (!item) return res.status(404).json({ error: 'Menu item not found' });

      if (String(item.vendorId) !== String(req.vendor._id)) {
        return res.status(403).json({ error: 'You do not own this menu item' });
      }

      await item.deleteOne();
      return res.json({ deleted: true, itemId: req.params.itemId });
    } catch (err) {
      console.error('Menu item delete error:', err);
      return res.status(500).json({ error: `Failed to delete menu item: ${err.name}: ${err.message}` });
    }
  }
);

// 3. Initiate Food Order & Stripe PaymentIntent
app.post(['/orders', '/api/food/orders', '/api/v1/food/orders'], async (req, res) => {
  const { seatNumber, items, vendorId } = req.body;
  const userId = req.headers['x-user-id'] || 'anonymous';

  if (!seatNumber || !items || items.length === 0) {
    return res.status(400).json({ error: 'seatNumber and items are required' });
  }

  // Validate Stripe Key environment variable
  const activeKey = process.env.STRIPE_SECRET_KEY;
  if (!activeKey || !activeKey.startsWith('sk_test_')) {
    console.error('❌ STRIPE_SECRET_KEY is missing or invalid in food-service/.env');
    return res.status(500).json({ error: 'Stripe configuration error on server' });
  }

  try {
    const totalAmountCents = items.reduce((acc, item) => acc + (item.priceCents * item.quantity), 0);

    // Create pending order record in MongoDB
    const order = await Order.create({
      userId,
      vendorId: vendorId || null,
      seatNumber: seatNumber.toUpperCase().trim(),
      items,
      totalAmountCents,
      paymentStatus: 'PENDING'
    });

    // Create Stripe PaymentIntent using active key instance
    const activeStripe = new Stripe(activeKey);
    const paymentIntent = await activeStripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: 'usd',
      metadata: {
        orderId: order._id.toString(),
        seatNumber: order.seatNumber
      }
    });

    order.paymentIntentId = paymentIntent.id;
    await order.save();

    console.log(`✅ PaymentIntent Created: ${paymentIntent.id} ($${(totalAmountCents / 100).toFixed(2)}) for Seat ${order.seatNumber}`);

    return res.status(201).json({
      orderId: order._id,
      clientSecret: paymentIntent.client_secret,
      totalAmountCents: order.totalAmountCents,
      order
    });
  } catch (err) {
    console.error('❌ Order Checkout Error:', err.message || err);
    return res.status(500).json({ error: err.message || 'Failed to initiate food order payment' });
  }
});

// 4. Local Dev Confirmation Endpoint (Instant Local Payment Approval)
app.post(['/confirm-dev', '/api/food/confirm-dev', '/api/v1/food/confirm-dev'], async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: 'orderId is required' });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.paymentStatus = 'COMPLETED';
    await order.save();

    // Broadcast live order to customer seat & kitchen dashboard
    // e.g. inside /confirm-dev, the webhook handler, and the status PATCH:
    io.to(`seat:${order.seatNumber}`).emit('orderUpdated', order);
    if (order.vendorId) {
      io.to(`vendor:${order.vendorId}`).emit(order.isNew ? 'newOrder' : 'orderUpdated', order);
    }

    console.log(`✅ [DEV CONFIRM] Food Order ${order._id} paid and sent to Kitchen for Seat ${order.seatNumber}`);
    return res.json(order);
  } catch (err) {
    console.error('Dev confirmation error:', err);
    return res.status(500).json({ error: 'Failed to confirm food payment' });
  }
});

// 5. Stripe Webhook Endpoint
app.post('/api/v1/food/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_FOOD_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const { orderId } = event.data.object.metadata;
    try {
      const order = await Order.findById(orderId);
      if (order) {
        order.paymentStatus = 'COMPLETED';
        await order.save();

        io.to(`seat:${order.seatNumber}`).emit('orderUpdated', order);
        io.to('kitchen').emit('newOrder', order);
        console.log(`✅ [STRIPE WEBHOOK] Food Order ${order._id} paid & sent to kitchen`);
      }
    } catch (err) {
      console.error('Webhook DB update failed:', err);
    }
  }

  res.json({ received: true });
});

// 6. Vendor/Runner Order Status Update — now ownership-checked
app.patch(['/orders/:orderId/status', '/api/food/orders/:orderId/status', '/api/v1/food/orders/:orderId/status'], async (req, res) => {
  const { status } = req.body;
  const requestingUserId = req.headers['x-user-id'];
  const valid = ['RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Ownership guard: the authenticated user must own the vendor this order belongs to
    const vendor = await Vendor.findById(order.vendorId);
    if (!vendor || vendor.ownerUserId !== requestingUserId) {
      return res.status(403).json({ error: 'You do not own this order' });
    }

    order.status = status;
    await order.save();

    io.to(`seat:${order.seatNumber}`).emit('orderUpdated', order);
    io.to(`vendor:${order.vendorId}`).emit('orderUpdated', order);

    return res.json(order);
  } catch (err) {
    console.error('Status update error:', err);
    return res.status(500).json({ error: 'Failed to update order status' });
  }
});

// --- Internal, service-to-service only. Never exposed through the gateway. ---
const requireInternalSecret = (req, res, next) => {
  if (req.headers['x-internal-secret'] !== process.env.INTERNAL_SERVICE_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// Called by auth-service right after a vendor-role account verifies its OTP.
// Upserted on ownerUserId so retries/duplicate calls are harmless.
app.post('/api/v1/food/internal/vendors', requireInternalSecret, async (req, res) => {
  const { ownerUserId, name } = req.body;
  if (!ownerUserId) {
    return res.status(400).json({ error: 'ownerUserId is required' });
  }

  try {
    const vendor = await Vendor.findOneAndUpdate(
      { ownerUserId },
      { $setOnInsert: { name: name || 'Unnamed Stand', ownerUserId, isActive: true } },
      { upsert: true, new: true }
    );
    return res.status(201).json(vendor);
  } catch (err) {
    console.error('Internal vendor creation error:', err);
    return res.status(500).json({ error: 'Failed to create vendor' });
  }
});

const PORT = process.env.PORT || 4003;
server.listen(PORT, () => console.log(`Food Service listening on port ${PORT}`));