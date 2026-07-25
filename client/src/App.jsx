import { useState, useEffect } from 'react';
import api from './api';
import SeatBooking from './components/SeatBooking';
import Checkout from './components/Checkout';
import TicketView from './components/TicketView';
import GateScanner from './components/GateScanner';
import FoodOrdering from './components/FoodOrdering';
import VendorDashboard from './components/VendorDashboard';

const setAuthHeader = (token) => {
  if (api && api.defaults) {
    if (!api.defaults.headers) api.defaults.headers = {};
    if (!api.defaults.headers.common) api.defaults.headers.common = {};
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || '');
  const [activeTab, setActiveTab] = useState('seats');
  
  const [selectedSeat, setSelectedSeat] = useState(() => {
    try {
      const saved = localStorage.getItem('selectedSeat');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Which seat number "In-Seat Food" should order to. Defaults to the seat
  // most recently booked/selected, but can be overridden by picking
  // "Order Food to Seat" on any ticket in "My Tickets & QR" (useful when a
  // user has booked multiple seats for friends and wants to order for a
  // specific one).
  const [foodSeatNumber, setFoodSeatNumber] = useState(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegister, setIsRegister] = useState(true);
  const [step, setStep] = useState('auth');
  
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authOtp, setAuthOtp] = useState('');
  
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  useEffect(() => {
    if (token) {
      setAuthHeader(token);
    }
  }, [token]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');

    try {
      if (isRegister) {
        const res = await api.post('/api/auth/register', {
          email: authEmail,
          phoneNumber: authPhone,
          password: authPassword,
        });

        if (res.data.debugOtp) {
          setAuthOtp(res.data.debugOtp);
        }

        setAuthMessage(res.data.message || 'Verification code sent!');
        setStep('otp');
      } else {
        const res = await api.post('/api/auth/login', {
          email: authEmail,
          password: authPassword,
        });

        const jwtToken = res.data.accessToken;
        
        localStorage.setItem('token', jwtToken);
        localStorage.setItem('userEmail', authEmail);
        
        setAuthHeader(jwtToken);
        setToken(jwtToken);
        setUserEmail(authEmail);
        setShowAuthModal(false);
        resetForm();
      }
    } catch (err) {
      console.error('Auth error:', err);
      setAuthError(err.response?.data?.error || err.response?.data?.message || 'Authentication failed.');
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');

    try {
      await api.post('/api/auth/verify-otp', {
        email: authEmail,
        otp: authOtp,
      });

      setAuthMessage('Account verified successfully! Please sign in.');
      setIsRegister(false);
      setStep('auth');
    } catch (err) {
      console.error('OTP error:', err);
      setAuthError(err.response?.data?.error || 'Invalid or expired OTP');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('selectedSeat');
    setAuthHeader(null);
    setToken('');
    setUserEmail('');
    setSelectedSeat(null);
    setFoodSeatNumber(null);
  };

  const resetForm = () => {
    setAuthEmail('');
    setAuthPhone('');
    setAuthPassword('');
    setAuthOtp('');
    setAuthError('');
    setAuthMessage('');
    setStep('auth');
  };

  const handleSeatSelectedForCheckout = (seat) => {
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    setSelectedSeat(seat);
    localStorage.setItem('selectedSeat', JSON.stringify(seat));
    setActiveTab('checkout');
  };

  // Payment succeeded for the currently selected seat. The booking itself
  // (and its QR code) now lives in the booking-service and is fetched fresh
  // by TicketView via /api/booking/my-tickets, so we just clear the
  // in-progress seat and jump to "My Tickets & QR".
  const handlePaymentSubmitted = () => {
    setSelectedSeat(null);
    localStorage.removeItem('selectedSeat');
    setActiveTab('ticket');
  };

  const handleGoToFood = (seatNumber) => {
    if (seatNumber) {
      setFoodSeatNumber(seatNumber);
    }
    setActiveTab('food');
  };

  if (window.location.pathname === '/vendor') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-6">
        <VendorDashboard token={token} />
      </div>
    );
  }

  if (window.location.pathname === '/scanner') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-6">
        <GateScanner />
      </div>
    );
  }

  const currentSeatId = selectedSeat?.id || selectedSeat?.seat_id || selectedSeat?._id;
  const currentSeatNumber = selectedSeat?.number || selectedSeat?.seat_number || selectedSeat?.name || 'A1';
  const currentPriceCents = selectedSeat?.price_cents || selectedSeat?.priceCents || selectedSeat?.price || 15000;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-white/10 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              HyperVenue
            </span>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('seats')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'seats' || activeTab === 'checkout'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              🎟️ Reserve Seats
            </button>

            <button
              onClick={() => setActiveTab('ticket')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'ticket'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              🎫 My Tickets & QR
            </button>

            <button
              onClick={() => setActiveTab('food')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'food'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              🍔 In-Seat Food
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {token ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 hidden md:inline font-mono">
                  {userEmail}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs transition-all border border-white/10"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  resetForm();
                  setShowAuthModal(true);
                }}
                className="px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-500/20 hover:opacity-90 transition-all"
              >
                Sign In / Sign Up
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Dynamic Tab Switching */}
      <main className="py-6 px-4">
        {activeTab === 'seats' && (
          <SeatBooking token={token} onSelectSeat={handleSeatSelectedForCheckout} />
        )}
        
        {activeTab === 'checkout' && selectedSeat && (
          <Checkout
            seatId={currentSeatId}
            seatNumber={currentSeatNumber}
            priceCents={currentPriceCents}
            onPaymentSubmitted={handlePaymentSubmitted}
            onCancel={() => setActiveTab('seats')}
          />
        )}

        {activeTab === 'ticket' && (
          <TicketView
            token={token}
            onGoToFood={handleGoToFood}
            onClose={() => setActiveTab('seats')}
          />
        )}

        {activeTab === 'food' && (
          <FoodOrdering token={token} seatNumber={foodSeatNumber || currentSeatNumber} />
        )}
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white text-sm"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold text-white mb-1">
              {step === 'otp' ? 'Verify OTP' : isRegister ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-xs text-zinc-400 mb-4">
              {step === 'otp' 
                ? `Enter the 6-digit code sent for ${authEmail}`
                : isRegister 
                  ? 'Sign up to reserve live match seats' 
                  : 'Sign in to access your bookings'
              }
            </p>

            {authError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                {authError}
              </div>
            )}

            {authMessage && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
                {authMessage}
              </div>
            )}

            {step === 'auth' ? (
              <form onSubmit={handleAuthSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {isRegister && (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="+1234567890"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/30 mt-2"
                >
                  {isRegister ? 'Sign Up & Get OTP' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">6-Digit Verification Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={authOtp}
                    onChange={(e) => setAuthOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-center text-lg tracking-widest font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/30 mt-2"
                >
                  Verify Account
                </button>

                <button
                  type="button"
                  onClick={() => setStep('auth')}
                  className="w-full text-xs text-zinc-500 hover:text-zinc-300 mt-1"
                >
                  ← Back to registration
                </button>
              </form>
            )}

            {step === 'auth' && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setAuthError('');
                    setAuthMessage('');
                  }}
                  className="text-xs text-indigo-400 hover:underline"
                >
                  {isRegister ? 'Already verified? Sign In' : "Don't have an account? Sign Up"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}