import { useState, useEffect } from 'react';
import api from '../api';
import { io } from 'socket.io-client';
import { 
  ShoppingBag, 
  CheckCircle2, 
  AlertCircle, 
  Utensils, 
  Radio, 
  Plus, 
  Minus, 
  ArrowRight 
} from 'lucide-react';

export default function FoodOrdering({ token }) {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch Food Menu (Your exact original call)
    api.get('/api/food/menu')
      .then((res) => setMenu(res.data))
      .catch(console.error);

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

  const removeFromCart = (itemId) => {
    setCart((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      if (current.qty <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return {
        ...prev,
        [itemId]: { ...current, qty: current.qty - 1 }
      };
    });
  };

  const totalItemCount = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);

  const totalAmountCents = Object.values(cart).reduce(
    (sum, item) => sum + item.priceCents * item.qty,
    0
  );

  const handleCheckout = async () => {
    setMessage(null);
    setError(null);

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
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Left Column: Menu Display */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Header Box */}
        <div className="p-6 rounded-2xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-xl">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Utensils className="w-3 h-3" /> EXPRESS DELIVERY
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white mt-2">In-Seat Catering Menu</h2>
            <p className="text-xs text-zinc-400">Order fresh meals, snacks & beverages straight to your seat number.</p>
          </div>
        </div>

        {/* Menu Cards Grid */}
        {menu.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/30 rounded-2xl border border-white/[0.05] space-y-2">
            <Utensils className="w-8 h-8 mx-auto text-zinc-600" />
            <p className="text-sm font-semibold text-zinc-400">No menu items available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {menu.map((item) => {
              const inCartQty = cart[item._id]?.qty || 0;

              return (
                <div 
                  key={item._id} 
                  className="group relative p-5 bg-zinc-900/40 border border-white/[0.08] hover:border-indigo-500/40 rounded-2xl flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/5 backdrop-blur-xl"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-400 uppercase bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {item.category || 'Catering'}
                      </span>
                      {inCartQty > 0 && (
                        <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {inCartQty} in cart
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-white mt-3 group-hover:text-indigo-200 transition-colors">
                      {item.name}
                    </h3>

                    <div className="text-base font-mono font-semibold text-zinc-300 mt-2">
                      ${(item.priceCents / 100).toFixed(2)}
                    </div>
                  </div>

                  {/* Add/Remove Action Controls */}
                  <div className="mt-6 pt-4 border-t border-white/[0.06]">
                    {inCartQty > 0 ? (
                      <div className="flex items-center justify-between bg-zinc-950/80 p-1.5 rounded-xl border border-white/10">
                        <button
                          onClick={() => removeFromCart(item._id)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-mono font-bold text-white">{inCartQty}</span>
                        <button
                          onClick={() => addToCart(item)}
                          className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        className="w-full py-2.5 bg-zinc-950 hover:bg-indigo-600 border border-white/10 hover:border-indigo-500 text-zinc-300 hover:text-white text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add to Order
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Cart Drawer & Live Websocket Stream */}
      <div className="space-y-6">
        
        {/* Cart Drawer Card */}
        <div className="p-6 bg-zinc-900/60 border border-white/[0.08] rounded-2xl backdrop-blur-xl shadow-2xl space-y-6">
          
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-indigo-400" /> Checkout Cart
            </h3>
            {totalItemCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-mono font-medium text-white bg-indigo-600 rounded-full">
                {totalItemCount} items
              </span>
            )}
          </div>

          {/* Feedback Banners */}
          {message && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Cart Itemized List */}
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {Object.values(cart).length === 0 ? (
              <div className="text-center py-8 text-zinc-500 space-y-2">
                <ShoppingBag className="w-8 h-8 mx-auto stroke-[1.5] text-zinc-600" />
                <p className="text-xs">Your cart is empty.</p>
              </div>
            ) : (
              Object.values(cart).map((item) => (
                <div key={item._id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-white/[0.04]">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-white">{item.name}</div>
                    <div className="text-[11px] font-mono text-zinc-400">
                      ${((item.priceCents * item.qty) / 100).toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => removeFromCart(item._id)}
                      className="p-1 rounded bg-zinc-800 text-zinc-300 hover:text-white"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-mono font-bold text-white w-4 text-center">{item.qty}</span>
                    <button
                      onClick={() => addToCart(item)}
                      className="p-1 rounded bg-zinc-800 text-zinc-300 hover:text-white"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pricing Breakdown */}
          <div className="pt-4 border-t border-white/[0.08] space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span>Subtotal</span>
              <span className="font-mono text-white">${(totalAmountCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span>In-Seat Delivery Fee</span>
              <span className="font-mono text-emerald-400 uppercase text-[10px] font-bold">Complimentary</span>
            </div>
            <div className="flex justify-between items-center pt-2 text-sm font-bold text-white">
              <span>Total</span>
              <span className="text-lg font-mono text-indigo-400">${(totalAmountCents / 100).toFixed(2)}</span>
            </div>
          </div>

          <button
            disabled={totalAmountCents === 0}
            onClick={handleCheckout}
            className="w-full py-3 bg-white hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-white text-zinc-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
          >
            Place Catering Order <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Live Order Stream */}
        <div className="p-5 bg-zinc-900/60 border border-white/[0.08] rounded-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Live Order Stream
            </h4>
            <span className="text-[10px] font-mono text-zinc-500">WS Connected</span>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {orders.length === 0 ? (
              <p className="text-xs text-zinc-600 italic py-2">Listening for incoming live order events...</p>
            ) : (
              orders.map((ord, idx) => (
                <div key={ord._id || idx} className="p-2.5 bg-zinc-950/80 rounded-xl text-xs flex justify-between items-center border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-zinc-300 font-mono text-[11px] truncate max-w-[120px]">
                      Order #{ord._id?.slice(-4) || idx + 1}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {ord.status || 'PLACED'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}