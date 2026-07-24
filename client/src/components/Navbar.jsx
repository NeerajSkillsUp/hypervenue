import { ShoppingBag, Lock, LogOut } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, token, onLogout }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-zinc-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        {/* Brand Logo (Updated with image logo) */}
        <div 
          className="flex items-center gap-3 cursor-pointer select-none group" 
          onClick={() => setActiveTab('booking')}
        >
          <img 
            src="/logo.png" 
            alt="HyperVenue Logo" 
            className="w-9 h-9 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200 object-cover" 
          />
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-white font-mono">
              HYPER<span className="text-indigo-400">VENUE</span>
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded">
              ENTERPRISE
            </span>
          </div>
        </div>

        {/* Segmented Control Navigation Tabs */}
        <nav className="flex items-center p-1 rounded-full bg-zinc-900/90 border border-white/[0.08] shadow-inner">
          <button
            onClick={() => setActiveTab('booking')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              activeTab === 'booking'
                ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Seat Booking
          </button>

          <button
            onClick={() => setActiveTab('food')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              activeTab === 'food'
                ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Food & Catering
          </button>
        </nav>

        {/* Right Status / Auth Actions */}
        <div className="flex items-center gap-3">
          {token ? (
            <div className="flex items-center gap-3">
              {/* Live Pulsing Auth Badge */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Authenticated
              </div>

              <button
                onClick={onLogout}
                className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded-lg transition-all"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveTab('auth')}
              className="px-4 py-1.5 bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold rounded-full transition-all shadow-sm active:scale-95"
            >
              Sign In
            </button>
          )}
        </div>

      </div>
    </header>
  );
}