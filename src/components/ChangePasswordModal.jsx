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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="theme-bg-card border theme-border shadow-2xl rounded-2xl max-w-md w-full p-6 sm:p-8 relative">
        
        {/* Academic Header */}
        <div className="text-center mb-6">
          <div className="bg-white/95 p-2 rounded-xl border border-cyan-500/50 shadow-md inline-block mb-3">
            <img 
              src="/psg_logo.png" 
              alt="PSG College of Technology Crest" 
              className="h-16 w-auto max-w-[72px] mx-auto object-contain"
            />
          </div>
          <h2 className="text-base sm:text-lg font-mono font-bold tracking-wider theme-text-primary uppercase">
            PSG College of Technology
          </h2>
          <p className="text-xs theme-heading-cyan font-mono font-bold tracking-wide mt-0.5">
            DEPT. OF COMPUTER APPLICATIONS • LOGIN 2026
          </p>
          <p className="text-[11px] theme-text-muted font-mono mt-1 tracking-wider">
            [ ALUMNI_ACCOUNT_SECURITY // PROT_V2.6 ]
          </p>
        </div>

        <div className="border-b theme-border pb-3 mb-4 text-center">
          <div className="inline-flex p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-2">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider theme-heading-cyan">
            &gt; SET YOUR ACCOUNT PASSWORD
          </h3>
          <p className="text-[11px] theme-text-muted font-mono mt-1 leading-relaxed">
            Welcome, <span className="font-bold theme-text-primary">{user.name}</span>! For your account security during the 48-hour event, please replace your default phone password with a personal password.
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
  );
}
