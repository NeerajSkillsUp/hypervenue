import { useState } from 'react';
import api from './api';
import SeatBooking from './components/SeatBooking';
import Checkout from './components/Checkout';
import TicketView from './components/TicketView';
import GateScanner from './components/GateScanner';
import FoodOrdering from './components/FoodOrdering';
import VendorDashboard from './components/VendorDashboard';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || '');
  const [activeTab, setActiveTab] = useState('seats');
  
  // Selected seat & booking state tracking
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [activeBookingId, setActiveBookingId] = useState(null);

  // Auth Modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegister, setIsRegister] = useState(true);
  const [step, setStep] = useState('auth'); // 'auth' | 'otp'
  
  // Auth Form Fields
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authOtp, setAuthOtp] = useState('');
  
  // Status & Error Messages
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  // 1. Handle Registration or Login Submission
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');

    try {
      if (isRegister) {
        // Calls Gateway at /api/auth/register -> Rewritten to Auth Service /api/v1/auth/register
        const res = await api.post('/api/auth/register', {
          email: authEmail,
          phoneNumber: authPhone,
          password: authPassword,
        });

        // Backend returns debugOtp for testing ease
        if (res.data.debugOtp) {
          setAuthOtp(res.data.debugOtp);
        }

        setAuthMessage(res.data.message || 'Verification code sent!');
        setStep('otp'); // Move to OTP verification step
      } else {
        // Calls Gateway at /api/auth/login -> Rewritten to Auth Service /api/v1/auth/login
        const res = await api.post('/api/auth/login', {
          email: authEmail,
          password: authPassword,
        });

        const jwtToken = res.data.accessToken;
        
        localStorage.setItem('token', jwtToken);
        localStorage.setItem('userEmail', authEmail);
        setToken(jwtToken);
        setUserEmail(authEmail);
        setShowAuthModal(false);
        resetForm();
      }
    } catch (err) {
      console.error('Auth error:', err);
      setAuthError(
        err.response?.data?.error || 
        err.response?.data?.message || 
        'Authentication failed. Please check backend connection.'
      );
    }
  };

  // 2. Handle OTP Verification Submission
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
      setIsRegister(false); // Switch to Sign In view
      setStep('auth');
    } catch (err) {
      console.error('OTP error:', err);
      setAuthError(err.response?.data?.error || 'Invalid or expired OTP');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    setToken('');
    setUserEmail('');
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
    setSelectedSeat(seat);
    setActiveTab('checkout');
  };

  const handlePaymentSubmitted = ({ bookingId }) => {
    setActiveBookingId(bookingId);
    setActiveTab('ticket');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header Navigation */}
      <header className="border-b border-white/10 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              HyperVenue
            </span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
              IND vs PAK
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
              🎟️ Seats
            </button>

            {activeBookingId && (
              <button
                onClick={() => setActiveTab('ticket')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'ticket'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                🎫 My Ticket
              </button>
            )}

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

            <button
              onClick={() => setActiveTab('scanner')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'scanner'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              📷 Gate Scanner
            </button>

            <button
              onClick={() => setActiveTab('vendor')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'vendor'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              🧑‍🍳 Kitchen Dashboard
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

      {/* Main Views */}
      <main className="py-6">
        {activeTab === 'seats' && <SeatBooking token={token} onSelectSeat={handleSeatSelectedForCheckout} />}
        {activeTab === 'checkout' && selectedSeat && (
          <Checkout
            seatId={selectedSeat.id}
            seatNumber={selectedSeat.number}
            onPaymentSubmitted={handlePaymentSubmitted}
            onCancel={() => setActiveTab('seats')}
          />
        )}
        {activeTab === 'ticket' && activeBookingId && (
          <TicketView
            bookingId={activeBookingId}
            seatNumber={selectedSeat?.number || 'A1'}
            onGoToFood={() => setActiveTab('food')}
          />
        )}
        {activeTab === 'food' && <FoodOrdering token={token} seatNumber={selectedSeat?.number || 'A1'} />}
        {activeTab === 'scanner' && <GateScanner />}
        {activeTab === 'vendor' && <VendorDashboard />}
      </main>

      {/* Auth & OTP Modal */}
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
                    placeholder="samjoe@gmail.com"
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