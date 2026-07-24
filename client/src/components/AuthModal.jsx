import { useState } from 'react';
import api from '../api';
import { 
  Mail, 
  Lock, 
  Phone, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  UserPlus, 
  LogIn 
} from 'lucide-react';

export default function AuthModal({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const switchMode = (newMode) => {
    setMode(newMode);
    setMessage(null);
    setError(null);
  };

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
    <div className="max-w-md mx-auto my-12 p-8 bg-zinc-900/60 border border-white/[0.08] rounded-2xl backdrop-blur-xl shadow-2xl relative overflow-hidden">
      
      {/* Decorative Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Section */}
      <div className="text-center mb-8 relative z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
          {mode === 'login' && <LogIn className="w-3.5 h-3.5" />}
          {mode === 'register' && <UserPlus className="w-3.5 h-3.5" />}
          {mode === 'verify' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
          <span className="uppercase tracking-wider">
            {mode === 'login' && 'Authentication'}
            {mode === 'register' && 'New Account'}
            {mode === 'verify' && 'Security Check'}
          </span>
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-white">
          {mode === 'login' && 'Welcome Back'}
          {mode === 'register' && 'Create Account'}
          {mode === 'verify' && 'Verify OTP'}
        </h2>
        
        <p className="text-xs text-zinc-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
          {mode === 'login' && 'Sign in to access high-speed booking & orders'}
          {mode === 'register' && 'Get started with HyperVenue today'}
          {mode === 'verify' && `Enter 6-digit OTP sent to ${email}`}
        </p>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="leading-tight">{message}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="leading-tight">{error}</span>
        </div>
      )}

      {/* LOGIN FORM */}
      {mode === 'login' && (
        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
          <div>
            <label className="block text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/80 border border-white/10 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                placeholder="user@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/80 border border-white/10 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
          >
            Sign In <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-center text-xs text-zinc-400 pt-2">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('register')}
              className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline underline-offset-4 transition-colors"
            >
              Register
            </button>
          </p>
        </form>
      )}

      {/* REGISTER FORM */}
      {mode === 'register' && (
        <form onSubmit={handleRegister} className="space-y-4 relative z-10">
          <div>
            <label className="block text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/80 border border-white/10 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                placeholder="user@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3.5 top-3 text-zinc-500" />
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/80 border border-white/10 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                placeholder="9876543210"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/80 border border-white/10 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
          >
            Register Account <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-center text-xs text-zinc-400 pt-2">
            Already registered?{' '}
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline underline-offset-4 transition-colors"
            >
              Sign In
            </button>
          </p>
        </form>
      )}

      {/* VERIFY OTP FORM */}
      {mode === 'verify' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4 relative z-10">
          <div>
            <label className="block text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-2 text-center">
              6-Digit OTP Code
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3 text-zinc-500" />
              <input
                type="text"
                required
                maxLength="6"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/80 border border-white/10 rounded-xl text-white text-center tracking-[0.3em] text-lg font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                placeholder="123456"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
          >
            Verify & Activate <ShieldCheck className="w-4 h-4" />
          </button>

          <p className="text-center text-xs text-zinc-400 pt-2">
            Wrong email?{' '}
            <button
              type="button"
              onClick={() => switchMode('register')}
              className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline underline-offset-4 transition-colors"
            >
              Back to Registration
            </button>
          </p>
        </form>
      )}

    </div>
  );
}