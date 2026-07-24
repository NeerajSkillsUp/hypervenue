import { useState, useEffect } from 'react';
import api from '../api';
import { 
  Lock, 
  Clock, 
  Check, 
  AlertCircle, 
  Calendar, 
  MapPin, 
  Sparkles, 
  Loader2 
} from 'lucide-react';

const EVENT_ID = '11111111-1111-1111-1111-111111111111';

export default function SeatBooking({ token }) {
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lockingId, setLockingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchSeats = async () => {
      try {
        const res = await api.get(`/api/booking/events/${EVENT_ID}/seats`);
        setSeats(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch seats');
      } finally {
        setLoading(false);
      }
    };

    fetchSeats();
    const interval = setInterval(fetchSeats, 5000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  const handleLockSeat = async (seatId) => {
    if (!token) {
      setError('Please sign in first to lock seats');
      return;
    }

    setLockingId(seatId);
    setError(null);
    setMessage(null);

    try {
      const res = await api.post('/api/booking/lock', { seatId });
      setMessage(res.data.message);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Seat locking failed');
    } finally {
      setLockingId(null);
    }
  };

  const availableCount = seats.filter(s => s.status === 'AVAILABLE').length;
  const lockedCount = seats.filter(s => s.status === 'LOCKED').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Event Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-6 md:p-8 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Sparkles className="w-3 h-3" /> LIVE ARENA
              </span>
              <span className="text-xs text-zinc-400 font-mono">ID: {EVENT_ID.slice(0, 8)}</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Taylor Swift — The Eras Tour
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" /> July 24, 2026
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-zinc-500" /> Main Arena Stadium — Section A
              </span>
            </div>
          </div>

          {/* Live Status Legend Badges */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/60 border border-white/[0.05] text-xs font-medium self-start md:self-auto">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{availableCount} Available</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{lockedCount} Locked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center justify-between shadow-lg backdrop-blur-md animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>{message}</span>
          </div>
          <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded">300s TTL</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-2.5 shadow-lg backdrop-blur-md animate-in fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Venue Seat Canvas */}
      <div className="relative rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6 md:p-10 backdrop-blur-xl">
        
        {/* Curved Main Stage Graphic */}
        <div className="relative mb-12 flex flex-col items-center">
          <div className="w-full max-w-lg h-12 bg-gradient-to-b from-indigo-500/20 via-indigo-500/5 to-transparent rounded-t-[100%] border-t border-indigo-500/40 flex items-center justify-center shadow-[0_-10px_25px_rgba(99,102,241,0.15)]">
            <span className="text-[11px] font-mono font-bold tracking-[0.25em] text-indigo-300 uppercase pl-1">
              Main Stage
            </span>
          </div>
          <div className="w-full max-w-md h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
        </div>

        {/* Seat Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs font-mono">Fetching real-time inventory...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {seats.map((seat) => {
              const isAvailable = seat.status === 'AVAILABLE';
              const isLocked = seat.status === 'LOCKED';
              const isPending = lockingId === seat.id;

              return (
                <button
                  key={seat.id}
                  disabled={!isAvailable || isPending}
                  onClick={() => handleLockSeat(seat.id)}
                  className={`relative group p-4 rounded-xl border flex flex-col items-center justify-between gap-3 transition-all duration-200 ${
                    isAvailable
                      ? 'bg-zinc-950/80 border-white/10 hover:border-indigo-500/50 hover:bg-zinc-900/90 hover:shadow-lg hover:shadow-indigo-500/10 cursor-pointer active:scale-[0.98]'
                      : isLocked
                      ? 'bg-amber-500/[0.06] border-amber-500/30 text-amber-200 cursor-not-allowed'
                      : 'bg-zinc-950/40 border-white/[0.03] text-zinc-600 cursor-not-allowed opacity-40'
                  }`}
                >
                  {/* Seat Identifier */}
                  <div className="text-base font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                    {seat.seat_number}
                  </div>

                  {/* Price Tag */}
                  <div className="text-xs font-mono text-zinc-400">
                    ${(seat.price_cents / 100).toFixed(2)}
                  </div>

                  {/* Status Indicator */}
                  <div className="w-full pt-2 border-t border-white/[0.06] flex items-center justify-center">
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    ) : isAvailable ? (
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 group-hover:text-emerald-300">
                        <Check className="w-3 h-3" /> Reserve
                      </span>
                    ) : isLocked ? (
                      <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Held
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-600 font-mono">Booked</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}