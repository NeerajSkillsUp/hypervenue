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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        token={token}
        onLogout={handleLogout}
      />

      <main className="container mx-auto px-4 pb-12">
        {activeTab === 'auth' && <AuthModal onLoginSuccess={handleLoginSuccess} />}
        {activeTab === 'booking' && <SeatBooking token={token} />}
        {activeTab === 'food' && <FoodOrdering token={token} />}
      </main>
    </div>
  );
}