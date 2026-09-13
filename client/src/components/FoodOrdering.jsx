import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../api';

// Stripe Imports
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const FOOD_SERVICE_URL = import.meta.env.VITE_FOOD_SERVICE_URL || 'http://localhost:4003';
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

// --- Embedded Stripe Payment Form Component ---
function FoodCheckoutForm({ orderId, totalCents, onPaymentSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage('');

    // Confirm payment directly with Stripe
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'Payment failed');
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        // Tell our backend which Stripe PaymentIntent actually succeeded.
        // The backend will retrieve the PaymentIntent directly from Stripe
        // and verify that it belongs to this order.
        await api.post('/api/food/confirm-payment', {
          orderId,
          paymentIntentId: paymentIntent.id,
        });

        // Only clear the cart / close checkout after the backend
        // successfully confirms the order.
        onPaymentSuccess();
      } catch (err) {
        console.error('Payment confirmation error:', err);

        setErrorMessage(
          err.response?.data?.error ||
          'Payment succeeded, but the order could not be confirmed yet. Please retry.'
        );

        // IMPORTANT:
        // Do NOT call onPaymentSuccess() here.
        // Otherwise the cart disappears while the order remains PENDING.
        setIsProcessing(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Stripe secure credit card input container */}
      <div className="bg-zinc-950 p-4 rounded-xl border border-white/10">
        <PaymentElement />
      </div>

      {errorMessage && (
        <div className="text-xs text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
          {errorMessage}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          disabled={isProcessing}
          onClick={onCancel}
          className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
        >
          {isProcessing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            `Pay $${(totalCents / 100).toFixed(2)}`
          )}
        </button>
      </div>
    </form>
  );
}

// --- Main Food Ordering Component ---
export default function FoodOrdering({ token, seatNumber = 'A1' }) {
  const normalizedSeat = seatNumber.toUpperCase().trim();

  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  
  // 🔑 Multiple Active Orders Array
  const [orders, setOrders] = useState([]);

  // Payment modal & Stripe state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const foodCheckoutIdempotencyKey = useRef(null);

  useEffect(() => {
    // 1. Fetch Food Menu
    api.get('/api/food/menu')
      .then(res => setMenu(res.data))
      .catch(err => console.error('Menu fetch error:', err));

    // 2. Fetch Active Orders for this Seat on page load
    api.get(`/api/food/orders/seat/${normalizedSeat}`)
      .then(res => setOrders(res.data))
      .catch(err => console.error('Fetch seat orders error:', err));

    // 3. Connect authenticated socket & join seat room
    const socket = io(FOOD_SERVICE_URL, { auth: { token } });

    socket.on('connect', () => {
      socket.emit('joinSeatRoom', { seatNumber: normalizedSeat });
    });

    socket.on('orderUpdated', (updatedOrder) => {
      console.log('Received seat order update:', updatedOrder);
      
      // Update existing order or append new order to list
      setOrders((prevOrders) => {
        const index = prevOrders.findIndex(o => o._id === updatedOrder._id);
        if (index !== -1) {
          const updatedArr = [...prevOrders];
          updatedArr[index] = updatedOrder;
          return updatedArr;
        } else {
          return [updatedOrder, ...prevOrders];
        }
      });
    });

    return () => socket.disconnect();
  }, [token, normalizedSeat]);

  // Adjust Cart Quantity
  const updateQuantity = (item, delta) => {
    setCart((prevCart) => {
      const existing = prevCart.find(i => i.menuItemId === item._id);

      if (!existing) {
        if (delta > 0) {
          return [
            ...prevCart,
            { menuItemId: item._id, name: item.name, priceCents: item.priceCents, quantity: 1 }
          ];
        }
        return prevCart;
      }

      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        return prevCart.filter(i => i.menuItemId !== item._id);
      }

      return prevCart.map(i =>
        i.menuItemId === item._id ? { ...i, quantity: newQty } : i
      );
    });
  };

  const getItemQuantity = (itemId) => {
    const found = cart.find(i => i.menuItemId === itemId);
    return found ? found.quantity : 0;
  };

  // Open modal and fetch PaymentIntent clientSecret from backend
  const handleOpenCheckoutModal = async () => {
    if (cart.length === 0) return;

    if (!foodCheckoutIdempotencyKey.current) {
      foodCheckoutIdempotencyKey.current = crypto.randomUUID();
    }

    setShowPaymentModal(true);
    setIsInitiating(true);
    setClientSecret('');

    try {
      const checkoutRes = await api.post('/api/food/orders', {
        seatNumber: normalizedSeat,
        items: cart,
        idempotencyKey: foodCheckoutIdempotencyKey.current,
      });

      setClientSecret(checkoutRes.data.clientSecret);
      setPendingOrderId(checkoutRes.data.orderId);
    } catch (err) {
      console.error('Failed to initiate Stripe checkout:', err);
      alert('Failed to initialize payment gateway.');
      setShowPaymentModal(false);
      setClientSecret('');
      setPendingOrderId(null);
      foodCheckoutIdempotencyKey.current = null;
    } finally {
      setIsInitiating(false);
    }
  };

  const handlePaymentSuccess = () => {
    setCart([]);
    setShowPaymentModal(false);
    setClientSecret('');
    foodCheckoutIdempotencyKey.current = null;
  };

  const totalCents = cart.reduce((acc, item) => acc + (item.priceCents * item.quantity), 0);

  // Status Stepper Helper
  const STATUSES = ['RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      
      {/* Menu Column */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex justify-between items-center bg-zinc-900/80 p-4 rounded-2xl border border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">In-Seat Catering</h2>
            <p className="text-xs text-zinc-400">
              Delivering directly to Seat <span className="text-indigo-400 font-bold">{normalizedSeat}</span>
            </p>
          </div>
          <span className="px-2.5 py-1 text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
            LIVE SEAT LINK
          </span>
        </div>

        {/* Menu Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {menu.map(item => {
            const qty = getItemQuantity(item._id);
            return (
              <div key={item._id} className="p-4 bg-zinc-900 border border-white/10 rounded-2xl flex flex-col justify-between hover:border-white/20 transition-all">
                <div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                    {item.category}
                  </span>
                  <h3 className="text-white font-semibold mt-2">{item.name}</h3>
                  <p className="text-indigo-400 font-mono text-sm mt-1">${(item.priceCents / 100).toFixed(2)}</p>
                </div>

                <div className="mt-4">
                  {qty === 0 ? (
                    <button
                      onClick={() => updateQuantity(item, 1)}
                      className="w-full py-2 bg-zinc-800 hover:bg-indigo-600 text-white text-xs font-semibold rounded-xl transition-all"
                    >
                      + Add to Order
                    </button>
                  ) : (
                    <div className="flex items-center justify-between bg-zinc-800/90 rounded-xl p-1 border border-indigo-500/30">
                      <button
                        onClick={() => updateQuantity(item, -1)}
                        className="w-8 h-8 flex items-center justify-center bg-zinc-700 hover:bg-red-500/80 text-white font-bold rounded-lg transition-all text-sm"
                      >
                        -
                      </button>
                      <span className="font-mono text-white text-sm font-bold">{qty}</span>
                      <button
                        onClick={() => updateQuantity(item, 1)}
                        className="w-8 h-8 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all text-sm"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cart & Status Column */}
      <div className="space-y-6">
        
        {/* Shopping Cart Card */}
        <div className="bg-zinc-900 p-6 rounded-2xl border border-white/10">
          <h3 className="text-white font-bold text-base mb-4">Your Order</h3>
          
          {cart.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">Your cart is empty</p>
          ) : (
            <div className="space-y-4">
              {cart.map(i => (
                <div key={i.menuItemId} className="flex items-center justify-between text-xs text-zinc-300">
                  <div className="flex-1 pr-2">
                    <p className="font-semibold text-white">{i.name}</p>
                    <p className="text-[10px] text-zinc-400 font-mono">${(i.priceCents / 100).toFixed(2)} each</p>
                  </div>

                  <div className="flex items-center gap-2 bg-zinc-800 px-2 py-1 rounded-lg border border-white/5">
                    <button
                      onClick={() => updateQuantity({ _id: i.menuItemId }, -1)}
                      className="text-zinc-400 hover:text-red-400 font-bold px-1"
                    >
                      -
                    </button>
                    <span className="font-mono text-white text-xs px-1">{i.quantity}</span>
                    <button
                      onClick={() => updateQuantity({ _id: i.menuItemId }, 1)}
                      className="text-zinc-400 hover:text-indigo-400 font-bold px-1"
                    >
                      +
                    </button>
                  </div>

                  <span className="font-mono text-indigo-400 font-bold w-16 text-right">
                    ${((i.priceCents * i.quantity) / 100).toFixed(2)}
                  </span>
                </div>
              ))}

              <div className="border-t border-white/10 pt-3 flex justify-between text-sm font-bold text-white">
                <span>Total</span>
                <span className="font-mono text-indigo-400">${(totalCents / 100).toFixed(2)}</span>
              </div>

              <button
                onClick={handleOpenCheckoutModal}
                className="w-full mt-4 py-3 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:opacity-90 transition-all"
              >
                Proceed to Payment (${(totalCents / 100).toFixed(2)})
              </button>
            </div>
          )}
        </div>

        {/* --- LIVE ORDER TRACKERS (LIST OF ALL ACTIVE ORDERS) --- */}
        {orders.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-white font-bold text-sm tracking-wide flex items-center justify-between px-1">
              <span>Active Seat Orders</span>
              <span className="text-xs bg-indigo-500/20 text-indigo-400 font-mono px-2 py-0.5 rounded-full">
                {orders.length}
              </span>
            </h3>

            {orders.map((activeOrder) => {
              const currentStatusIndex = STATUSES.indexOf(activeOrder.status);

              return (
                <div key={activeOrder._id} className="bg-zinc-900 border border-indigo-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 flex items-center gap-1.5 w-max">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        LIVE ORDER STATUS
                      </span>
                      <h4 className="text-sm font-bold text-white mt-2">
                        Order #{activeOrder._id ? activeOrder._id.slice(-6) : 'LIVE'}
                      </h4>
                    </div>

                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                      ✓ PAID
                    </span>
                  </div>

                  {/* Visual Stepper */}
                  <div className="grid grid-cols-4 gap-1 py-1">
                    {STATUSES.map((st, idx) => {
                      const isPassed = idx <= currentStatusIndex;
                      const isCurrent = idx === currentStatusIndex;
                      return (
                        <div key={st} className="flex flex-col items-center gap-1">
                          <div className={`h-1.5 w-full rounded-full transition-all ${
                            isPassed ? 'bg-indigo-500' : 'bg-zinc-800'
                          } ${isCurrent ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-zinc-900' : ''}`} />
                          <span className={`text-[9px] font-mono uppercase text-center ${
                            isCurrent ? 'text-indigo-400 font-bold' : isPassed ? 'text-zinc-300' : 'text-zinc-600'
                          }`}>
                            {st.replace(/_/g, ' ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Itemized Receipt Proof */}
                  <div className="bg-zinc-950 p-3.5 rounded-xl border border-white/5 space-y-2">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2 border-b border-white/5 pb-1 flex justify-between">
                      <span>Items Ordered</span>
                      <span className="text-indigo-400">Seat {normalizedSeat}</span>
                    </div>

                    {activeOrder.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-zinc-300">
                        <span>
                          <strong className="text-indigo-400 mr-1.5">{item.quantity}x</strong>
                          {item.name}
                        </span>
                        <span className="font-mono text-zinc-400">
                          ${((item.priceCents * item.quantity) / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}

                    <div className="border-t border-white/10 pt-2 mt-2 flex justify-between items-center text-xs font-bold text-white">
                      <span>Total Paid</span>
                      <span className="font-mono text-indigo-400 text-sm">
                        ${((activeOrder.totalAmountCents || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Delivery Footer Note */}
                  <p className="text-[11px] text-center text-zinc-400 bg-zinc-800/40 p-2.5 rounded-xl border border-white/5">
                    {activeOrder.status === 'DELIVERED' 
                      ? '🎉 Order delivered to your seat! Enjoy your meal.' 
                      : `🛵 In-seat runner will deliver directly to Seat ${normalizedSeat}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Stripe Payment Checkout Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">In-Seat Delivery Checkout</h3>
            <p className="text-xs text-zinc-400">
              Confirming order for seat <span className="text-indigo-400 font-bold">{normalizedSeat}</span>
            </p>

            <div className="bg-zinc-950 p-3 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span>${(totalCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>In-Seat Delivery Fee</span>
                <span className="text-green-400 font-medium">FREE</span>
              </div>
              <div className="flex justify-between font-bold text-white pt-2 border-t border-white/10">
                <span>Total Due</span>
                <span className="text-indigo-400 font-mono">${(totalCents / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Render Stripe Form when clientSecret is ready */}
            {isInitiating ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-zinc-400">Initializing Stripe checkout...</span>
              </div>
            ) : clientSecret ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: { theme: 'night' }
                }}
              >
                <FoodCheckoutForm
                  orderId={pendingOrderId}
                  totalCents={totalCents}
                  onPaymentSuccess={handlePaymentSuccess}
                  onCancel={() => {
                    setShowPaymentModal(false);
                    setClientSecret('');
                    setPendingOrderId(null);
                    foodCheckoutIdempotencyKey.current = null;
                  }}
                />
              </Elements>
            ) : (
              <div className="text-xs text-red-400 py-4 text-center">
                Could not load payment element. Check server logs.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}