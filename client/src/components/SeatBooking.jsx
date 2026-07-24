import { useState, useEffect } from 'react';
import api from '../api';
import { Lock, Clock, Check, AlertCircle } from 'lucide-react';

const EVENT_ID = '11111111-1111-1111-1111-111111111111';

export default function SeatBooking({ token }) {
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lockingId, setLockingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); // State trigger for manual refetch

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
  }, [refreshKey]); // Triggers on initial mount + when refreshKey changes

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
      setRefreshKey((prev) => prev + 1); // Trigger seat refresh
    } catch (err) {
      setError(err.response?.data?.error || 'Seat locking failed');
    } finally {
      setLockingId(null);
    }
  };

  // ... rest of JSX

  return (
    <div className="max-w-4xl mx-auto mt-8 p-8 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl">
      <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-6">
        <div>
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Live Venue Stadium</span>
          <h2 className="text-3xl font-extrabold text-white mt-1">Taylor Swift - The Eras Tour</h2>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Available</span>
          <span className="flex items-center gap-1.5 text-amber-400"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Locked (Hold)</span>
          <span className="flex items-center gap-1.5 text-slate-500"><span className="w-3 h-3 rounded-full bg-slate-700"></span> Booked</span>
        </div>
      </div>

      {message && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
          <Clock className="w-5 h-5 flex-shrink-0" /> {message}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Stage Visual representation */}
      <div className="w-full py-3 mb-10 bg-gradient-to-r from-indigo-900/50 via-purple-900/50 to-indigo-900/50 border border-indigo-500/30 rounded-xl text-center text-indigo-300 text-xs tracking-widest font-bold uppercase shadow-inner">
        🎤 MAIN STAGE 🎤
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading seat map...</div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {seats.map((seat) => {
            const isAvailable = seat.status === 'AVAILABLE';
            const isLocked = seat.status === 'LOCKED';

            return (
              <button
                key={seat.id}
                disabled={!isAvailable || lockingId === seat.id}
                onClick={() => handleLockSeat(seat.id)}
                className={`p-6 rounded-2xl border flex flex-col items-center justify-between gap-3 transition-all ${
                  isAvailable
                    ? 'bg-slate-950 border-emerald-500/40 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 cursor-pointer'
                    : isLocked
                    ? 'bg-amber-500/10 border-amber-500/40 cursor-not-allowed text-amber-300'
                    : 'bg-slate-950 border-slate-800 cursor-not-allowed opacity-50'
                }`}
              >
                <div className="text-xl font-black">{seat.seat_number}</div>
                <div className="text-sm font-semibold text-slate-400">
                  ${(seat.price_cents / 100).toFixed(2)}
                </div>
                <div className="w-full pt-2 border-t border-slate-800/80 text-center">
                  {isAvailable && (
                    <span className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Reserve
                    </span>
                  )}
                  {isLocked && (
                    <span className="text-xs font-bold text-amber-400 flex items-center justify-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> Held
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}