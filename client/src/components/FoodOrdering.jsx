import { useState, useEffect } from 'react';
import api from '../api';
import { io } from 'socket.io-client';
import { ShoppingBag, CheckCircle2, AlertCircle, Utensils, Radio } from 'lucide-react';

export default function FoodOrdering({ token }) {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch Food Menu
    api.get('/api/food/menu').then((res) => setMenu(res.data)).catch(console.error);

    // Socket.io real-time updates directly from Food Service
    const socket = io('http://localhost:4003');

    socket.on('newOrderPlaced', (newOrder) => {
      setOrders((prev) => [newOrder, ...prev]);
    });

    return () => socket.disconnect();
  }, []);

  const addToCart = (item) => {
    setCart((prev) => ({
      ...prev,
      [item._id]: { ...item, qty: (prev[item._id]?.qty || 0) + 1 }
    }));
  };

  const totalAmountCents = Object.values(cart).reduce(
    (sum, item) => sum + item.priceCents * item.qty,
    0
  );

  const handleCheckout = async () => {
    if (!token) {
      setError('Please sign in first to place food orders');
      return;
    }

    const itemsPayload = Object.values(cart).map((i) => ({
      menuItemId: i._id,
      quantity: i.qty
    }));

    try {
      const res = await api.post('/api/food/orders', {
        items: itemsPayload,
        totalAmountCents
      });
      setMessage(res.data.message);
      setCart({});
    } catch (err) {
      setError(err.response?.data?.error || 'Order placement failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-8 grid grid-cols-3 gap-8">
      {/* Menu Column */}
      <div className="col-span-2 p-8 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Utensils className="w-6 h-6 text-indigo-400" /> In-Seat Catering Menu
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {menu.map((item) => (
            <div key={item._id} className="p-5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">{item.category}</span>
                <h3 className="font-bold text-white mt-1">{item.name}</h3>
                <p className="text-slate-400 text-sm font-mono mt-1">${(item.priceCents / 100).toFixed(2)}</p>
              </div>
              <button
                onClick={() => addToCart(item)}
                className="mt-4 py-2 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold rounded-lg transition-all"
              >
                + Add to Cart
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Cart & Real-time Feeds Column */}
      <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl flex flex-col justify-between gap-6">
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-400" /> Your Cart
          </h3>

          {message && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> {message}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 text-rose-400 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="space-y-3 mb-6">
            {Object.values(cart).length === 0 ? (
              <p className="text-xs text-slate-500 italic">Cart is empty</p>
            ) : (
              Object.values(cart).map((item) => (
                <div key={item._id} className="flex justify-between items-center text-sm">
                  <span className="text-slate-300">{item.name} x{item.qty}</span>
                  <span className="font-mono text-white">${((item.priceCents * item.qty) / 100).toFixed(2)}</span>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-between items-center mb-4">
            <span className="text-slate-400 text-sm">Total</span>
            <span className="text-xl font-extrabold text-white font-mono">${(totalAmountCents / 100).toFixed(2)}</span>
          </div>

          <button
            disabled={totalAmountCents === 0}
            onClick={handleCheckout}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20"
          >
            Place Order
          </button>
        </div>

        {/* Real-time Orders Feed */}
        <div className="pt-4 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Live Order Stream
          </h4>
          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {orders.length === 0 ? (
              <p className="text-xs text-slate-600 italic">No live orders yet</p>
            ) : (
              orders.map((ord, idx) => (
                <div key={ord._id || idx} className="p-2 bg-slate-950 rounded-lg text-xs flex justify-between items-center border border-slate-800">
                  <span className="text-slate-300 truncate max-w-[140px]">Order #{ord._id?.slice(-4) || idx + 1}</span>
                  <span className="text-emerald-400 font-semibold">{ord.status || 'PLACED'}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}