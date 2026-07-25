import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../api';

export default function GateScanner() {
  const [result, setResult] = useState(null);

  useEffect(() => {
    const html5QrcodeScanner = new Html5QrcodeScanner('reader', { 
      fps: 10, 
      qrbox: { width: 250, height: 250 } 
    });

    html5QrcodeScanner.render(async (decodedText) => {
      try {
        const payload = JSON.parse(decodedText);
        const bookingId = payload.bookingId;

        // Verify ticket against booking service checkin endpoint
        const res = await api.post('/api/booking/checkin', { bookingId });
        setResult({ ok: true, message: `${res.data.message} — Seat ID: ${res.data.seatId}` });
      } catch (err) {
        setResult({ 
          ok: false, 
          message: err.response?.data?.error || 'Invalid QR code scan' 
        });
      }
    });

    return () => {
      html5QrcodeScanner.clear().catch(() => {});
    };
  }, []);

  const handleReset = () => {
    setResult(null);
    window.location.reload();
  };

  return (
    <div className="max-w-md mx-auto my-8 p-6 bg-zinc-900 border border-white/10 rounded-2xl shadow-xl text-center">
      <h2 className="text-lg font-bold text-white mb-2">🎟️ Stadium Gate Scanner</h2>
      <p className="text-xs text-zinc-400 mb-6">Point camera at attendee's ticket QR code</p>

      <div id="reader" className="overflow-hidden rounded-xl bg-black border border-zinc-800" />

      {result && (
        <div className={`mt-6 p-4 rounded-xl border text-sm font-medium ${
          result.ok 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          <div className="text-2xl mb-1">{result.ok ? '✅ ACCESS GRANTED' : '❌ ENTRY DENIED'}</div>
          <p className="text-xs">{result.message}</p>
          <button 
            onClick={handleReset}
            className="mt-4 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs"
          >
            Scan Next Attendee
          </button>
        </div>
      )}
    </div>
  );
}