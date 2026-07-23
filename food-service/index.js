require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io server with CORS enabled
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// Connect to MongoDB Container
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// -------------------------------------------------------------
// MongoDB Schemas
// -------------------------------------------------------------
const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true }, // e.g., "Drinks", "Snacks"
  priceCents: { type: Number, required: true },
  isAvailable: { type: Boolean, default: true }
});

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [
    {
      menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
      quantity: { type: Number, default: 1 }
    }
  ],
  totalAmountCents: { type: Number, required: true },
  status: { type: String, enum: ['PREPARING', 'READY', 'DELIVERED'], default: 'PREPARING' },
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

// -------------------------------------------------------------
// Real-time Socket.io Connection Logic
// -------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  socket.on('joinOrderRoom', (orderId) => {
    socket.join(orderId);
    console.log(`[SOCKET] Client ${socket.id} joined room: order_${orderId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
  });
});

// -------------------------------------------------------------
// REST Endpoints
// -------------------------------------------------------------

// 1. GET FOOD MENU
app.get('/api/v1/food/menu', async (req, res) => {
  try {
    const items = await MenuItem.find({ isAvailable: true });
    return res.json(items);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. PLACE AN ORDER
app.post('/api/v1/food/orders', async (req, res) => {
  const { items, totalAmountCents } = req.body;
  const userId = req.headers['x-user-id'] || 'test-user-id'; // Passed down from Gateway

  if (!items || !items.length || !totalAmountCents) {
    return res.status(400).json({ error: 'Invalid order request payload' });
  }

  try {
    const order = new Order({
      userId,
      items,
      totalAmountCents
    });

    await order.save();

    // Broadcast order event via WebSockets
    io.emit('newOrderPlaced', order);

    return res.status(201).json({
      message: 'Order placed successfully',
      order
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. SEED INITIAL MENU ITEMS (Helper Route)
app.post('/api/v1/food/seed', async (req, res) => {
  try {
    await MenuItem.deleteMany({});
    const seeded = await MenuItem.insertMany([
      { name: 'Gourmet Salted Popcorn', category: 'Snacks', priceCents: 850 },
      { name: 'Craft IPA Beer', category: 'Drinks', priceCents: 1200 },
      { name: 'Classic Cheeseburger', category: 'Hot Food', priceCents: 1400 },
      { name: 'Sparkling Water', category: 'Drinks', priceCents: 400 }
    ]);
    return res.json({ message: 'Menu seeded successfully', items: seeded });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 4003;
server.listen(PORT, () => console.log(`Food Service running on port ${PORT}`));