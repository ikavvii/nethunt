import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const { user, token, updateUser } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters in length.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify both fields.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password.');
      }

      setSuccess(true);
      if (updateUser) {
        updateUser({
          ...user,
          passkey: newPassword,
          password_changed: 1,
          mustChangePassword: false
        });
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Error communicating with server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md overflow-y-auto flex items-center justify-center p-3 sm:p-6 min-h-screen">
      <div className="theme-bg-card border theme-border shadow-2xl rounded-2xl max-w-xl w-full p-5 sm:p-7 relative max-h-[92vh] flex flex-col my-auto transition-all">
        
        {/* Academic Header with Crest inline */}
        <div className="flex items-center space-x-3.5 pb-3.5 border-b theme-border mb-4">
          <div className="bg-white/95 p-1.5 rounded-xl border border-cyan-500/50 shadow-md flex-shrink-0">
            <img 
              src="/psg_logo.png" 
              alt="PSG College of Technology Crest" 
              className="h-10 sm:h-12 w-auto max-w-[48px] sm:max-w-[54px] object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-mono font-black tracking-wider theme-text-primary uppercase truncate">
                PSG College of Technology
              </h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hidden sm:inline-block flex-shrink-0">
                LOGIN 2026
              </span>
            </div>
            <p className="text-xs text-cyan-600 dark:text-cyan-400 font-mono font-bold tracking-wide mt-0.5 truncate">
              DEPT. OF COMPUTER APPLICATIONS • ACCOUNT SECURITY
            </p>
            <p className="text-[10px] theme-text-muted font-mono tracking-wider">
              [ ALUMNI_ACCOUNT_SECURITY // PROT_V2.6 ]
            </p>
          </div>
        </div>

        <div className="overflow-y-auto pr-1 flex-1">
          <div className="border-b theme-border pb-3 mb-4 text-center">
            <div className="inline-flex p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-2">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider theme-heading-cyan">
              &gt; SET YOUR ACCOUNT PASSWORD
            </h3>
            <p className="text-[11px] theme-text-muted font-mono mt-1 leading-relaxed">
              Welcome, <span className="font-bold theme-text-primary">{user.name}</span>! For your account security during the event (11th Aug – 17th Aug 2026), please replace your default phone password with a personal password.
            </p>
          </div>

        {/* Success Alert */}
        {success && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-mono mb-4 flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>Password updated successfully. Loading Hunt Arena...</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-500 dark:text-rose-400 text-xs font-mono flex items-center space-x-2 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Password Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-[11px] uppercase tracking-wider theme-text-secondary mb-1">
                &gt; NEW PERSONAL PASSWORD
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 4 characters)"
                required
                autoFocus
                data-allow-paste="true"
                className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-xs focus:outline-none focus:border-cyan-400 shadow-inner transition-colors allow-paste select-text"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider theme-text-secondary mb-1">
                &gt; CONFIRM NEW PASSWORD
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                data-allow-paste="true"
                className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-xs focus:outline-none focus:border-cyan-400 shadow-inner transition-colors allow-paste select-text"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              {loading ? <span>[ SAVING_CREDENTIALS... ]</span> : <span>[ SAVE PASSWORD & ENTER HUNT ]</span>}
            </button>
          </form>
        )}
        </div>

      </div>
    </div>
  );
}
