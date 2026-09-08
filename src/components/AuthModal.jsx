import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, LogIn, Shield, AlertCircle, CheckCircle } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const { login, adminLogin } = useAuth();
  const [tab, setTab] = useState('alumni'); // 'alumni' | 'admin' | 'recover'
  const [username, setUsername] = useState('');
  const [passkey, setPasskey] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverPhone, setRecoverPhone] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Clear modal form and status messages whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPasskey('');
      setAdminKey('');
      setRecoverEmail('');
      setRecoverPhone('');
      setRecoverySuccess(null);
      setError(null);
      setLoading(false);
      setTab('alumni');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRecoverPasskey = async (e) => {
    e.preventDefault();
    setError(null);
    setRecoverySuccess(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/recover-passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoverEmail, phone: recoverPhone })
      });
      const data = await res.json();
      if (res.ok) {
        setRecoverySuccess(data.message);
        setUsername(recoverPhone || recoverEmail);
        setPasskey(data.passkey);
        setTab('alumni');
      } else {
        setError(data.error || 'Failed to recover passkey');
      }
    } catch (err) {
      setError('Network error during passkey recovery: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === 'alumni') {
        await login(username, passkey);
        onClose();
      } else if (tab === 'admin') {
        await adminLogin(adminKey);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Contact organizers for access.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="theme-bg-card border theme-border shadow-2xl rounded-2xl max-w-md w-full p-6 sm:p-8 relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg font-mono text-xs theme-text-muted hover:text-cyan-400 hover:theme-bg-surface transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand with Official PSG Crest */}
        <div className="text-center mb-6">
          <div className="bg-white/95 p-2 rounded-xl border border-cyan-500/50 shadow-md inline-block mb-3">
            <img 
              src="/psg_logo.png" 
              alt="PSG College of Technology Crest" 
              className="h-16 w-auto max-w-[72px] mx-auto object-contain" 
            />
          </div>
          <h2 className="text-lg sm:text-xl font-mono font-black tracking-wider theme-text-primary uppercase">
            PSG College of Technology
          </h2>
          <p className="text-xs sm:text-sm text-cyan-600 dark:text-cyan-400 font-mono font-bold tracking-wide mt-1">
            DEPT. OF COMPUTER APPLICATIONS • LOGIN//2026
          </p>
          <p className="text-xs theme-text-muted font-mono mt-1 tracking-wider">
            [ ALUMNI_CRYPTIC_GATEWAY // PROT_V2.6 ]
          </p>
        </div>

        {/* Tab Switch */}
        <div className="flex theme-bg-surface p-1 rounded-xl border theme-border mb-5 text-xs sm:text-sm font-mono">
          <button
            type="button"
            onClick={() => { setTab('alumni'); setError(null); }}
            className={`flex-1 py-2.5 rounded-lg font-bold transition-all cursor-pointer ${
              tab === 'alumni' 
                ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/50 shadow-sm' 
                : 'theme-text-muted hover:text-cyan-600 dark:hover:text-cyan-400'
            }`}
          >
            [ ALUMNI ACCESS ]
          </button>
          <button
            type="button"
            onClick={() => { setTab('admin'); setError(null); }}
            className={`flex-1 py-2.5 rounded-lg font-bold transition-all cursor-pointer ${
              tab === 'admin' 
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/50 shadow-sm' 
                : 'theme-text-muted hover:text-amber-600 dark:hover:text-amber-400'
            }`}
          >
            [ GAME MASTER ]
          </button>
        </div>

        {/* Success Alert */}
        {recoverySuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-mono mb-4 flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{recoverySuccess}</span>
          </div>
        )}

        {/* Error alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-500 dark:text-rose-400 text-xs sm:text-sm font-mono flex items-center space-x-2 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Recovery Form Mode */}
        {tab === 'recover' ? (
          <form onSubmit={handleRecoverPasskey} className="space-y-4 text-xs sm:text-sm">
            <div className="border-b theme-border pb-2 mb-2">
              <span className="font-mono font-bold text-xs sm:text-sm theme-heading-cyan uppercase">
                &gt; SELF-SERVICE PASSWORD RECOVERY
              </span>
              <p className="text-xs theme-text-muted font-mono mt-1">
                Enter your registered Email & Phone to reset your password back to your phone number.
              </p>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold uppercase tracking-wider theme-text-secondary mb-1">
                &gt; REGISTERED EMAIL
              </label>
              <input
                type="email"
                value={recoverEmail}
                onChange={(e) => setRecoverEmail(e.target.value)}
                placeholder="e.g. alumni@psgtech.ac.in"
                required
                className="w-full theme-bg-surface border theme-border rounded-xl p-3.5 theme-text-primary text-sm focus:outline-none focus:border-cyan-400 font-mono shadow-inner transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label className="block font-mono text-xs font-bold uppercase tracking-wider theme-text-secondary mb-1">
                &gt; REGISTERED MOBILE NUMBER (10 DIGITS)
              </label>
              <input
                type="text"
                value={recoverPhone}
                onChange={(e) => setRecoverPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                required
                className="w-full theme-bg-surface border theme-border rounded-xl p-3.5 theme-text-primary text-sm focus:outline-none focus:border-cyan-400 font-mono shadow-inner transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-black text-xs sm:text-sm uppercase tracking-wider shadow-sm transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              {loading ? <span>[ VERIFYING... ]</span> : <span>[ RESET PASSWORD TO MOBILE ]</span>}
            </button>

            <button
              type="button"
              onClick={() => { setTab('alumni'); setError(null); }}
              className="w-full text-center text-xs sm:text-sm font-mono theme-text-muted hover:text-cyan-500 pt-2 cursor-pointer font-bold"
            >
              ← Back to Sign In
            </button>
          </form>
        ) : (
          /* Standard Login Form */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
            {tab === 'alumni' ? (
              <>
                <div>
                  <label className="block font-mono text-xs font-bold uppercase tracking-wider theme-text-secondary mb-1">
                    &gt; REGISTERED EMAIL OR MOBILE NUMBER
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. alumni@psgtech.ac.in or 9876543210"
                    required
                    className="w-full theme-bg-surface border theme-border rounded-xl p-3.5 theme-text-primary text-sm sm:text-base focus:outline-none focus:border-cyan-400 font-mono shadow-inner transition-colors"
                    autoFocus
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-mono text-xs font-bold uppercase tracking-wider theme-text-secondary">
                      &gt; PASSWORD (DEFAULT: REGISTERED PHONE)
                    </label>
                    <button
                      type="button"
                      onClick={() => { setTab('recover'); setError(null); }}
                      className="text-xs font-mono theme-label-cyan hover:underline cursor-pointer font-bold"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={passkey}
                    onChange={(e) => setPasskey(e.target.value)}
                    placeholder="e.g. 9876543210 or your password"
                    required
                    className="w-full theme-bg-surface border theme-border rounded-xl p-3.5 theme-text-primary text-sm sm:text-base focus:outline-none focus:border-cyan-400 font-mono shadow-inner transition-colors"
                  />
                </div>

                <p className="text-xs theme-text-muted font-mono leading-relaxed">
                  * Registered alumni: Log in with your <span className="text-cyan-600 dark:text-cyan-400 font-bold">Email</span> or <span className="text-cyan-600 dark:text-cyan-400 font-bold">Mobile Number</span>. Default password is your <span className="text-cyan-600 dark:text-cyan-400 font-bold">Phone Number</span>. You will be prompted to set a personal password upon first login.
                </p>
              </>
            ) : (
              <div>
                <label className="block font-mono text-xs font-bold uppercase tracking-wider theme-text-secondary mb-1">
                  &gt; GAME MASTER SECRET KEY
                </label>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Admin secret passkey"
                  required
                  className="w-full theme-bg-surface border theme-border rounded-xl p-3.5 theme-text-primary text-sm sm:text-base focus:outline-none focus:border-amber-400 font-mono shadow-inner transition-colors"
                  autoFocus
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 mt-3 rounded-xl font-mono font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                tab === 'alumni'
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md disabled:opacity-50'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md disabled:opacity-50'
              }`}
            >
              {loading ? <span>[ VERIFYING_CREDENTIALS... ]</span> : <span>[ INITIALIZE_SESSION ]</span>}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
