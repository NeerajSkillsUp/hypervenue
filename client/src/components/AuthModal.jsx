import { useState } from 'react';
import api from '../api';
import { Mail, Lock, Phone, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AuthModal({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await api.post('/api/auth/register', { email, password, phoneNumber });
      setMessage(res.data.message);
      setMode('verify');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await api.post('/api/auth/verify-otp', { email, otp });
      setMessage(res.data.message);
      setMode('login');
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      onLoginSuccess(res.data.accessToken);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">
          {mode === 'login' && 'Welcome Back'}
          {mode === 'register' && 'Create Account'}
          {mode === 'verify' && 'Verify OTP'}
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          {mode === 'login' && 'Sign in to access high-speed booking & orders'}
          {mode === 'register' && 'Get started with HyperVenue today'}
          {mode === 'verify' && `Enter 6-digit OTP sent to ${email}`}
        </p>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {message}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {mode === 'login' && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                placeholder="user@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25">
            Sign In
          </button>
          <p className="text-center text-sm text-slate-400 mt-4">
            Don't have an account?{' '}
            <button type="button" onClick={() => setMode('register')} className="text-indigo-400 hover:underline">
              Register
            </button>
          </p>
        </form>
      )}

      {mode === 'register' && (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                placeholder="user@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
            <div className="relative">
              <Phone className="w-5 h-5 absolute left-3 top-3 text-slate-500" />
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                placeholder="9876543210"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25">
            Register Account
          </button>
          <p className="text-center text-sm text-slate-400 mt-4">
            Already registered?{' '}
            <button type="button" onClick={() => setMode('login')} className="text-indigo-400 hover:underline">
              Sign In
            </button>
          </p>
        </form>
      )}

      {mode === 'verify' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">6-Digit OTP</label>
            <div className="relative">
              <KeyRound className="w-5 h-5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                required
                maxLength="6"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-center tracking-widest text-lg font-mono focus:outline-none focus:border-indigo-500"
                placeholder="123456"
              />
            </div>
          </div>
          <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-600/25">
            Verify & Activate
          </button>
        </form>
      )}
    </div>
  );
}