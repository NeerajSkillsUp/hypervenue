import { useEffect, useState } from 'react';
import api from '../api';

export default function TicketView({ bookingId, onClose }) {
  const [ticket, setTicket] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchTicket = async () => {
      try {
        // Try requesting ticket details with relative path fallback
        let res;
        try {
          res = await api.get(`/api/booking/tickets/${bookingId}`);
        } catch {
          res = await api.get(`/tickets/${bookingId}`);
        }

        if (isMounted && res.data && res.data.payment_status === 'COMPLETED') {
          setTicket(res.data);
          return true; // Stop polling
        }
      } catch (err) {
        console.error('Error fetching ticket:', err);
      }
      return false;
    };

    // 1. Fetch immediately on mount
    fetchTicket();

    // 2. Poll every 2 seconds until payment status becomes COMPLETED
    const poll = setInterval(async () => {
      const completed = await fetchTicket();
      if (completed) {
        clearInterval(poll);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(poll);
    };
  }, [bookingId]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-indigo-500/30 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
        {!ticket ? (
          <div className="py-12 space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-white">Confirming Payment Webhook...</p>
            <p className="text-xs text-zinc-400">Generating your secure stadium QR entry ticket</p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <span className="px-2.5 py-0.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                ENTRY CONFIRMED
              </span>
              <h3 className="text-xl font-bold text-white pt-2">Official Match Ticket</h3>
              <p className="text-xs text-zinc-400">Scan at Gate Scanner for Entry</p>
            </div>

            {/* Rendered QR Code */}
            <div className="bg-white p-4 rounded-2xl inline-block shadow-lg">
              <img src={ticket.qr_code_payload} alt="Your Entry QR Code" className="w-48 h-48 mx-auto" />
            </div>

            <div className="bg-zinc-950 p-3 rounded-xl text-left text-xs space-y-1">
              <div className="flex justify-between text-zinc-400">
                <span>Booking Ref</span>
                <span className="font-mono text-white">{ticket.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Payment Status</span>
                <span className="font-semibold text-emerald-400">{ticket.payment_status}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
            >
              Done / Head to Match
            </button>
          </>
        )}
      </div>
    </div>
  );
}