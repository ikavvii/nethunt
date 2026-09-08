import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import HuntArena from './components/HuntArena';
import Leaderboard from './components/Leaderboard';
import AdminDashboard from './components/AdminDashboard';
import AuthModal from './components/AuthModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import { useClipboardGuard } from './utils/useClipboardGuard';

function MainLayout() {
  const [activeTab, setActiveTab] = useState('hunt');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const { user } = useAuth();

  // Enforce global clipboard protection (disabled everywhere, enabled only in designated areas)
  useClipboardGuard(user);

  useEffect(() => {
    if (user && user.role !== 'admin' && (user.password_changed === 0 || user.mustChangePassword)) {
      setChangePasswordModalOpen(true);
    } else {
      setChangePasswordModalOpen(false);
    }
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col justify-between theme-bg-page theme-text-primary transition-colors select-none">
      <div>
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onOpenAuth={() => setAuthModalOpen(true)}
        />

        <main className="pb-16">
          {activeTab === 'hunt' && (
            <HuntArena 
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          )}
          {activeTab === 'standings' && (
            <Leaderboard />
          )}
          {activeTab === 'admin' && (
            <div className="admin-dashboard-container">
              <AdminDashboard />
            </div>
          )}
        </main>
      </div>

      <footer className="border-t theme-border py-6 px-4 text-center text-xs theme-text-muted font-sans">
        <div className="max-w-[1700px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <img src="/psg_logo.png" alt="PSG Tech" className="h-5 w-auto object-contain opacity-80" />
            <span className="text-sky-400 font-bold">LOGIN 2026</span>
            <span>•</span>
            <span>Department of Computer Applications</span>
            <span>•</span>
            <span>PSG College of Technology</span>
          </div>

          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setActiveTab('standings')} 
              className="hover:theme-text-primary transition-colors"
            >
              Standings
            </button>
            {user?.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('admin')} 
                className="text-sky-400 hover:text-sky-300 font-semibold transition-colors"
              >
                Admin Control
              </button>
            )}
          </div>
        </div>
      </footer>

      <AuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
      />

      <ChangePasswordModal
        isOpen={changePasswordModalOpen}
        onClose={() => setChangePasswordModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}
