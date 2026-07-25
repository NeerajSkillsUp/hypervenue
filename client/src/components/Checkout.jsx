import { useEffect, useState, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { v4 as uuidv4, validate as validateUUID } from 'uuid';
import api from '../api';

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

const ensureValidUUID = (id) => {
  if (!id) return null;
  const idStr = String(id);
  if (validateUUID(idStr)) return idStr;
  return '00000000-0000-4000-8000-' + idStr.padStart(12, '0').slice(-12);
};

function PaymentForm({ bookingId, seatId, onSuccess, onClose, isProcessing, setIsProcessing }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      alert(error.message);
      setIsProcessing(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        await api.post('/api/booking/confirm-dev', { bookingId, seatId });
      } catch (confirmErr) {
        console.warn('Dev confirmation endpoint warning:', confirmErr);
      }

      if (typeof onSuccess === 'function') {
        // Always pass raw ID string
        onSuccess(bookingId);
      }
    } else {
      setIsProcessing(false);
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

export default function Checkout({ seatId, seatNumber, priceCents, onSuccess, onPaymentSubmitted, onClose, onCancel }) {
  const idempotencyKey = useRef(uuidv4());
  
  const handleSuccess = onSuccess || onPaymentSubmitted;
  const handleClose = onClose || onCancel;

  const validSeatId = ensureValidUUID(seatId);

  const [errorMessage, setErrorMessage] = useState(
    !stripePublicKey 
      ? 'Missing VITE_STRIPE_PUBLIC_KEY in client/.env' 
      : !validSeatId 
        ? 'Invalid seat selection: Missing valid seat ID.' 
        : null
  );
  const [clientSecret, setClientSecret] = useState(null);
  const [bookingId, setBookingId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!stripePublicKey || !validSeatId) return;

    api.post('/api/booking/checkout', {
      seatId: validSeatId,
      idempotencyKey: idempotencyKey.current,
    })
    .then((res) => {
      const secret = res.data.clientSecret || res.data.client_secret;
      const returnedBookingId = res.data.bookingId || res.data.booking_id || res.data.id;

      if (secret && returnedBookingId) {
        setClientSecret(secret);
        setBookingId(String(returnedBookingId));
      } else {
        setErrorMessage('Checkout failed: Missing clientSecret or bookingId from server.');
      }
    })
    .catch((err) => {
      console.error('Checkout creation failed:', err);
      const backendErr = err.response?.data?.error || err.response?.data?.message || 'Failed to initialize checkout session';
      setErrorMessage(backendErr === 'Missing or malformed Authorization header' 
        ? 'Please Sign In first to complete checkout.' 
        : backendErr
      );
    });
  }, [validSeatId]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white">Complete Seat Purchase</h3>
          <p className="text-xs text-zinc-400">
            Reserving Seat <span className="text-indigo-400 font-bold">{seatNumber}</span> for ${((priceCents || 1000) / 100).toFixed(2)}
          </p>
        </div>

        {errorMessage ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl space-y-3">
            <p className="font-semibold">{errorMessage}</p>
            <button
              onClick={handleClose}
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
          /* key={clientSecret} forces remount when clientSecret changes, resolving the Stripe error */
          <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
            <PaymentForm
              bookingId={bookingId}
              seatId={validSeatId}
              onSuccess={handleSuccess}
              onClose={handleClose}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}