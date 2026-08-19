import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../api';

const FOOD_SERVICE_URL = import.meta.env.VITE_FOOD_SERVICE_URL || 'http://localhost:4003';

const STATUS_FLOW = ['RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

// --- Menu Management Panel ---
// Self-contained: fetches its own data on mount and owns its own form state,
// so it doesn't interfere with the KDS order-polling/socket effect above.
function MenuManagementPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Add-item form state. Price is entered in dollars in the UI and
  // converted to integer cents right before it's sent to the API —
  // HyperVenue stores and transmits money as cents everywhere else.
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPrice, setNewPrice] = useState('');

  // Inline edit state: which item id is being edited, and its draft values
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', category: '', price: '' });

  // Issues the request and stores the result. Every setState call here
  // lives inside .then/.catch/.finally, so none of it runs synchronously
  // as part of whatever called fetchMenu() — safe to call directly from
  // an effect body without triggering the "setState synchronously within
  // an effect" cascading-render warning.
  const fetchMenu = (cancelledRef) => {
    return api.get('/api/food/vendor/menu')
      .then((res) => {
        if (cancelledRef?.current) return;
        setItems(res.data.items || []);
        setError('');
      })
      .catch((err) => {
        if (cancelledRef?.current) return;
        console.error('Failed to fetch vendor menu:', err);
        setError(err.response?.data?.error || 'Failed to load your menu.');
      })
      .finally(() => {
        if (cancelledRef?.current) return;
        setLoading(false);
      });
  };

  // User-triggered reload (e.g. the "Retry" link below). This runs from an
  // event handler, not an effect, so setState here synchronously is fine.
  const reload = () => {
    setLoading(true);
    setError('');
    fetchMenu();
  };

  useEffect(() => {
    // Initial load on mount. `loading` and `error` already start at their
    // correct values (true / ''), so nothing needs to be set synchronously
    // here — fetchMenu()'s own synchronous portion just issues the request;
    // every state update happens later, inside its .then/.catch/.finally.
    const cancelledRef = { current: false };
    fetchMenu(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const dollarsToCents = (val) => Math.round(parseFloat(val) * 100);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newCategory.trim() || !newPrice) return;

    const priceCents = dollarsToCents(newPrice);
    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      setError('Enter a valid price greater than $0.00');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await api.post('/api/food/vendor/menu', {
        name: newName.trim(),
        category: newCategory.trim(),
        priceCents,
      });
      setItems((prev) => [...prev, res.data]);
      setNewName('');
      setNewCategory('');
      setNewPrice('');
    } catch (err) {
      console.error('Failed to add menu item:', err);
      setError(err.response?.data?.error || 'Failed to add item.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setEditDraft({
      name: item.name,
      category: item.category,
      price: (item.priceCents / 100).toFixed(2),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({ name: '', category: '', price: '' });
  };

  const saveEdit = async (itemId) => {
    const priceCents = dollarsToCents(editDraft.price);
    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      setError('Enter a valid price greater than $0.00');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/api/food/vendor/menu/${itemId}`, {
        name: editDraft.name.trim(),
        category: editDraft.category.trim(),
        priceCents,
      });
      setItems((prev) => prev.map((it) => (it._id === itemId ? res.data : it)));
      cancelEdit();
    } catch (err) {
      console.error('Failed to update menu item:', err);
      setError(err.response?.data?.error || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (item) => {
    // Optimistic update, rolled back on failure
    const nextValue = !item.isAvailable;
    setItems((prev) => prev.map((it) => (it._id === item._id ? { ...it, isAvailable: nextValue } : it)));
    try {
      await api.patch(`/api/food/vendor/menu/${item._id}`, { isAvailable: nextValue });
    } catch (err) {
      console.error('Failed to toggle availability:', err);
      setItems((prev) => prev.map((it) => (it._id === item._id ? { ...it, isAvailable: !nextValue } : it)));
      setError('Failed to update availability. Please try again.');
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Remove this item from your menu? This cannot be undone.')) return;
    try {
      await api.delete(`/api/food/vendor/menu/${itemId}`);
      setItems((prev) => prev.filter((it) => it._id !== itemId));
    } catch (err) {
      console.error('Failed to delete menu item:', err);
      setError(err.response?.data?.error || 'Failed to delete item.');
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={reload}
            className="shrink-0 px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Add Item Form */}
      <form
        onSubmit={handleAddItem}
        className="bg-zinc-900/80 p-6 rounded-2xl border border-white/10 grid grid-cols-1 sm:grid-cols-[2fr_1.5fr_1fr_auto] gap-3 items-end"
      >
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Item name</label>
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Loaded Nachos"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Category</label>
          <input
            type="text"
            required
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="e.g. Snacks"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Price ($)</label>
          <input
            type="number"
            required
            min="0.01"
            step="0.01"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="8.50"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
        >
          + Add Item
        </button>
      </form>

      {/* Menu List */}
      {loading ? (
        <div className="py-20 text-center text-zinc-500 text-sm">Loading your menu...</div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center bg-zinc-900/40 rounded-2xl border border-dashed border-white/10">
          <p className="text-zinc-400 text-sm font-semibold">No menu items yet</p>
          <p className="text-xs text-zinc-600 mt-1">Add your first item above to start selling.</p>
        </div>
      ) : (
        <div className="bg-zinc-900/80 rounded-2xl border border-white/10 divide-y divide-white/5">
          {items.map((item) => {
            const isEditing = editingId === item._id;
            return (
              <div key={item._id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                {isEditing ? (
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={editDraft.name}
                      onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      value={editDraft.category}
                      onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editDraft.price}
                      onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{item.name}</h3>
                      <span className="text-[10px] uppercase font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 font-mono">
                      ${(item.priceCents / 100).toFixed(2)}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 shrink-0">
                  {/* Availability toggle */}
                  <button
                    onClick={() => toggleAvailability(item)}
                    disabled={isEditing}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-40 ${
                      item.isAvailable
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                    }`}
                  >
                    {item.isAvailable ? '● Available' : '○ Hidden'}
                  </button>

                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveEdit(item._id)}
                        disabled={saving}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg transition-all"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold rounded-lg transition-all"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(item)}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold rounded-lg transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item._id)}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-bold rounded-lg transition-all border border-rose-500/20"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function VendorDashboard({ token }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'DELIVERED'
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('orders'); // 'orders' | 'menu'

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

          <div className="flex items-center gap-3">
            {/* Orders vs Menu view toggle */}
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/10 text-xs font-semibold">
              {[
                { key: 'orders', label: '📋 Orders' },
                { key: 'menu', label: '🍔 Menu' },
              ].map((v) => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    view === v.key
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Order status filter — only relevant on the Orders view */}
            {view === 'orders' && (
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
            )}
          </div>
        </div>

        {view === 'menu' && <MenuManagementPanel />}

        {/* Order Grid */}
        {view === 'orders' && (loading ? (
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
        ))}
      </div>
    </div>
  );
}