import { useEffect, useState } from 'react';
import api from '../api';

export default function TicketView({ token, onGoToFood, onClose }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Not signed in: nothing to fetch. `tickets` already defaults to [],
    // and the render path below never shows ticket data when !token,
    // so there's no stale state to clear here.
    if (!token) {
      return;
    }

    let isMounted = true;

    const fetchTickets = async () => {
      if (isMounted) {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await api.get('/api/booking/my-tickets');
        if (isMounted) {
          setTickets(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        console.error('Failed to fetch tickets:', err);
        if (isMounted) {
          setError(err.response?.data?.error || 'Failed to load your tickets.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTickets();

    return () => {
      isMounted = false;
    };
  }, [token, refreshKey]);

  const handleRefresh = () => setRefreshKey((prev) => prev + 1);

  // Not signed in — nothing to show yet.
  if (!token) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-zinc-900 border border-white/10 rounded-2xl text-center space-y-4">
        <div className="text-4xl">🎟️</div>
        <h3 className="text-lg font-bold text-white">Sign in to see your tickets</h3>
        <p className="text-xs text-zinc-400">
          You need to sign in before your booked seats and QR codes will show up here.
        </p>
      </div>
    );
  }

  if (loading && tickets.length === 0) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-zinc-900 border border-white/10 rounded-2xl text-center space-y-3">
        <div className="text-indigo-400 animate-spin text-2xl">⏳</div>
        <p className="text-xs text-zinc-400 animate-pulse">Fetching your booked tickets…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-zinc-900 border border-rose-500/20 rounded-2xl text-center space-y-4">
        <p className="text-xs font-semibold text-rose-400">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-zinc-900 border border-white/10 rounded-2xl text-center space-y-4">
        <div className="text-4xl">🎟️</div>
        <h3 className="text-lg font-bold text-white">No tickets yet</h3>
        <p className="text-xs text-zinc-400">
          You haven't booked any seats yet. Reserve a seat to get your QR entry pass.
        </p>
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs"
        >
          Go to Seat Selection
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">My Tickets & QR</h2>
          <p className="text-xs text-zinc-400">
            {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'} booked on this account — scan each one separately at the gate.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs transition-all border border-white/10"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tickets.map((ticket) => {
          const qrImage = ticket?.qr_code_payload || ticket?.qr_code || ticket?.qrCode;
          const isPaid = ticket?.payment_status === 'COMPLETED';
          const displaySeat = ticket?.seat_number || ticket?.number || 'A1';

          return (
            <div
              key={ticket.id}
              className="bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="bg-gradient-to-r from-indigo-600 to-cyan-600 p-6 text-white text-center space-y-1">
                <span className="text-[10px] font-mono uppercase bg-black/20 px-3 py-1 rounded-full text-indigo-100">
                  MATCH DAY PASS
                </span>
                <h2 className="text-xl font-black tracking-tight pt-2">Taylor Swift — The Eras Tour</h2>
                <p className="text-xs text-indigo-100 font-medium">Main Arena Stadium — Section A</p>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4 bg-zinc-950/50 p-4 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-[10px] uppercase font-mono text-zinc-500">Seat Reserved</p>
                    <p className="text-lg font-bold text-indigo-400">
                      Seat #{displaySeat}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-mono text-zinc-500">Payment Status</p>
                    <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isPaid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {isPaid ? '✓ PAID' : 'PENDING'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center space-y-3 p-6 bg-white rounded-2xl shadow-inner">
                  {qrImage ? (
                    <img
                      src={qrImage}
                      alt={`QR Code for Seat ${displaySeat}`}
                      className="w-44 h-44 object-contain"
                    />
                  ) : (
                    <div className="w-44 h-44 bg-zinc-100 rounded-xl flex items-center justify-center text-xs text-zinc-400 text-center p-4">
                      QR Code unavailable
                    </div>
                  )}
                  <p className="text-[11px] font-mono text-zinc-600 text-center tracking-tight">
                    Scan this QR code at <span className="font-bold text-zinc-900">Gate Scanner (/scanner)</span> for entry.
                  </p>
                </div>

                <button
                  onClick={() => onGoToFood?.(displaySeat)}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                >
                  🍔 Order Food to Seat #{displaySeat}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium rounded-xl transition-all border border-white/10"
        >
          ← Reserve Another Seat
        </button>
      </div>
    </div>
  );
}