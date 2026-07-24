import { useState } from 'react';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import SeatBooking from './components/SeatBooking';
import FoodOrdering from './components/FoodOrdering';

export default function App() {
  const [activeTab, setActiveTab] = useState('booking');
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  const handleLoginSuccess = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setActiveTab('booking');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white antialiased">
      {/* Ambient Radial Background Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-gradient-to-b from-indigo-500/15 via-purple-500/5 to-transparent blur-[120px] rounded-full opacity-80" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-blue-600/10 blur-[140px] rounded-full pointer-events-none" />
      </div>

      {/* Main Content Wrapper */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          token={token}
          onLogout={handleLogout}
        />

        <main className="flex-1 container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">
          <div className="transition-all duration-300">
            {activeTab === 'auth' && (
              <AuthModal onLoginSuccess={handleLoginSuccess} />
            )}
            {activeTab === 'booking' && (
              <SeatBooking token={token} />
            )}
            {activeTab === 'food' && (
              <FoodOrdering token={token} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}