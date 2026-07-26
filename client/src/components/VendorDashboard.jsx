import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../api';

const FOOD_SERVICE_URL = import.meta.env.VITE_FOOD_SERVICE_URL || 'http://localhost:4003';

const STATUS_FLOW = ['RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function VendorDashboard({ token }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'DELIVERED'
  const [loading, setLoading] = useState(true);

  // 1. Fetch initial orders & set up Socket.IO connection
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await api.get('/api/food/orders/vendor/my-orders');
        setOrders(res.data.orders);
      } catch (err) {
        console.error('Failed to fetch vendor orders:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();

    const socket = io(FOOD_SERVICE_URL, { auth: { token } });

    socket.on('connect', () => {
      socket.emit('joinVendorRoom'); // now actually handled server-side
    });

    socket.on('newOrder', (newOrder) => {
      setOrders((prev) => [newOrder, ...prev.filter(o => o._id !== newOrder._id)]);
    });

    socket.on('orderUpdated', (updatedOrder) => {
      setOrders((prev) => prev.map((ord) => (ord._id === updatedOrder._id ? updatedOrder : ord)));
    });

    return () => socket.disconnect();
  }, [token]);

  // 2. Advance Order Status
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      // Sent directly to backend without saving unused 'res'
      await api.patch(`/api/food/orders/${orderId}/status`, {
        status: newStatus,
      });

      // Optimistically update local state
      setOrders((prev) =>
        prev.map((ord) => (ord._id === orderId ? { ...ord, status: newStatus } : ord))
      );
    } catch (err) {
      console.error('Failed to update order status:', err);
      alert('Could not update order status.');
    }
  };

  // Filtered orders list
  const displayedOrders = orders.filter((ord) => {
    if (filter === 'ACTIVE') return ord.status !== 'DELIVERED';
    if (filter === 'DELIVERED') return ord.status === 'DELIVERED';
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RECEIVED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'PREPARING':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'OUT_FOR_DELIVERY':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'DELIVERED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/80 p-6 rounded-2xl border border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-xl font-extrabold tracking-tight">Kitchen Order Display (KDS)</h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Live in-seat catering fulfillment terminal
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/10 text-xs font-semibold">
            {['ALL', 'ACTIVE', 'DELIVERED'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === f
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {f} ({orders.filter(o => f === 'ALL' ? true : f === 'ACTIVE' ? o.status !== 'DELIVERED' : o.status === 'DELIVERED').length})
              </button>
            ))}
          </div>
        </div>

        {/* Order Grid */}
        {loading ? (
          <div className="py-20 text-center text-zinc-500 text-sm">
            Loading kitchen orders...
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="py-20 text-center bg-zinc-900/40 rounded-2xl border border-dashed border-white/10">
            <p className="text-zinc-400 text-sm font-semibold">No orders found</p>
            <p className="text-xs text-zinc-600 mt-1">
              New seat orders will appear here automatically when paid.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedOrders.map((order) => {
              const currentIdx = STATUS_FLOW.indexOf(order.status);
              const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

              return (
                <div
                  key={order._id}
                  className={`bg-zinc-900 border rounded-2xl p-5 space-y-4 flex flex-col justify-between transition-all ${
                    order.status === 'RECEIVED'
                      ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Order Card Top */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-zinc-400">
                          #{order._id ? order._id.slice(-6) : 'ORDER'}
                        </span>
                        <h3 className="text-lg font-black text-indigo-400">
                          Seat {order.seatNumber}
                        </h3>
                      </div>

                      <span
                        className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border uppercase ${getStatusBadge(
                          order.status
                        )}`}
                      >
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Item List */}
                    <div className="bg-zinc-950 p-3 rounded-xl border border-white/5 space-y-2">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="text-zinc-200 font-medium">
                            <strong className="text-indigo-400 font-bold mr-2 text-sm">
                              {item.quantity}x
                            </strong>
                            {item.name}
                          </span>
                          <span className="font-mono text-zinc-400 text-[11px]">
                            ${((item.priceCents * item.quantity) / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}

                      <div className="border-t border-white/10 pt-2 flex justify-between items-center text-xs font-bold text-white">
                        <span className="text-zinc-400 font-normal">Total</span>
                        <span className="font-mono text-indigo-400">
                          ${((order.totalAmountCents || 0) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="pt-2 border-t border-white/5">
                    {nextStatus ? (
                      <button
                        onClick={() => handleUpdateStatus(order._id, nextStatus)}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                      >
                        <span>Mark as</span>
                        <span className="uppercase tracking-wider font-mono underline underline-offset-2">
                          {nextStatus.replace(/_/g, ' ')}
                        </span>
                        <span>→</span>
                      </button>
                    ) : (
                      <div className="py-2 text-center text-xs text-emerald-400 font-mono font-semibold bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        ✓ ORDER COMPLETED
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}