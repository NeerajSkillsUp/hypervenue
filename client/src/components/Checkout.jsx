import { useEffect, useState, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { v4 as uuidv4 } from 'uuid';
import api from '../api';

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

function PaymentForm({ bookingId, seatId, onSuccess, onClose, isProcessing, setIsProcessing }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);

    // 1. Confirm payment with Stripe
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      alert(error.message);
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // 2. Dev Fallback: Confirm booking directly with backend so you don't get stuck on loading screen
      try {
        await api.post('/api/booking/confirm-dev', { bookingId, seatId });
      } catch (confirmErr) {
        console.warn('Dev confirmation error, proceeding to polling/onSuccess:', confirmErr);
      }
      onSuccess(bookingId);
    } else {
      onSuccess(bookingId);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          disabled={isProcessing}
          onClick={onClose}
          className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex justify-center items-center gap-2"
        >
          {isProcessing ? 'Processing Payment...' : 'Pay Now'}
        </button>
      </div>
    </form>
  );
}

export default function Checkout({ seatId, seatNumber, priceCents, onSuccess, onClose }) {
  const idempotencyKey = useRef(uuidv4());
  
  // Initialize error state immediately if key is missing
  const [errorMessage, setErrorMessage] = useState(
    !stripePublicKey ? 'Missing VITE_STRIPE_PUBLIC_KEY in client/.env' : null
  );
  const [clientSecret, setClientSecret] = useState(null);
  const [bookingId, setBookingId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Exit early if missing key
    if (!stripePublicKey) return;

    api.post('/api/booking/checkout', {
      seatId,
      idempotencyKey: idempotencyKey.current,
    })
    .then((res) => {
      console.log('Backend response:', res.data);
      
      const secret = res.data.clientSecret || res.data.client_secret;

      if (secret) {
        setClientSecret(secret);
        setBookingId(res.data.bookingId);
      } else {
        setErrorMessage('Backend response missing clientSecret. Check backend JSON response keys.');
      }
    })
    .catch((err) => {
      console.error('Checkout creation failed:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to initialize checkout session');
    });
  }, [seatId]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white">Complete Seat Purchase</h3>
          <p className="text-xs text-zinc-400">
            Reserving Seat <span className="text-indigo-400 font-bold">{seatNumber}</span> for ${(priceCents / 100).toFixed(2)}
          </p>
        </div>

        {errorMessage ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl space-y-3">
            <p className="font-semibold">{errorMessage}</p>
            <button
              onClick={onClose}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs"
            >
              Close
            </button>
          </div>
        ) : !clientSecret ? (
          <div className="py-8 text-center text-xs text-zinc-400 animate-pulse">
            Connecting to Secure Payment Gateway...
          </div>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
            <PaymentForm
              bookingId={bookingId}
              seatId={seatId}
              onSuccess={onSuccess}
              onClose={onClose}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}