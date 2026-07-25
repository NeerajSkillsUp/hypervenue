import { useEffect, useState } from 'react';
import api from '../api';

export default function VendorDashboard() {
  const [orders, setOrders] = useState([]);

  const fetchOrders = () => {
    api.get('/api/food/orders')
      .then(res => setOrders(res.data))
      .catch(err => console.error('Error fetching orders:', err));
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000); // Poll for new orders
    return () => clearInterval(interval);
  }, []);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await api.patch(`/api/food/orders/${orderId}/status`, { status: newStatus });
      fetchOrders();
    } catch (err) {
      console.error('Status update error:', err);
      alert('Failed to update status');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h2 className="text-xl font-bold text-white mb-6">🧑‍🍳 Kitchen & Runner Control Center</h2>
      <div className="space-y-4">
        {orders.map(order => (
          <div key={order._id} className="p-4 bg-zinc-900 border border-white/10 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded">
                  SEAT {order.seatNumber}
                </span>
                <span className="text-xs text-zinc-400 font-mono">#{order._id.slice(-6)}</span>
              </div>
              <div className="text-xs text-zinc-300 mt-2 space-x-2">
                {order.items.map((i, idx) => (
                  <span key={idx}>{i.name} (x{i.quantity})</span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {['RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'].map((st) => (
                <button
                  key={st}
                  onClick={() => handleStatusUpdate(order._id, st)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    order.status === st 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {st.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}