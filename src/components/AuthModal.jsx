import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, LogIn, Shield, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

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
  const [notRegistered, setNotRegistered] = useState(false);
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
      setNotRegistered(false);
      setLoading(false);
      setTab('alumni');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRecoverPasskey = async (e) => {
    e.preventDefault();
    setError(null);
    setNotRegistered(false);
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
        setNotRegistered(false);
      } else {
        setError(data.error || 'Failed to recover passkey');
        setNotRegistered(Boolean(data.notRegistered || (data.error && (data.error.includes('not found') || data.error.includes('login.psgtech.ac.in/alumni')))));
      }
    } catch (err) {
      setError('Network error during passkey recovery: ' + err.message);
      setNotRegistered(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setNotRegistered(false);
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
      setNotRegistered(Boolean(
        err.notRegistered || 
        (err.message && (err.message.includes('not found') || err.message.includes('login.psgtech.ac.in/alumni')))
      ));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md overflow-y-auto flex items-center justify-center p-3 sm:p-6 min-h-screen">
      <div className="theme-bg-card border theme-border shadow-2xl rounded-2xl max-w-2xl w-full p-5 sm:p-7 relative max-h-[92vh] flex flex-col my-auto transition-all">
        
        {/* Academic Header with Crest & Close Button inline */}
        <div className="flex items-center justify-between pb-3.5 border-b theme-border mb-4">
          <div className="flex items-center space-x-3.5 min-w-0">
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
                  LOGIN//2026
                </span>
              </div>
              <p className="text-xs text-cyan-600 dark:text-cyan-400 font-mono font-bold tracking-wide mt-0.5 truncate">
                DEPT. OF COMPUTER APPLICATIONS • MCA ALUMNI GATEWAY
              </p>
              <p className="text-[10px] theme-text-muted font-mono tracking-wider">
                [ ALUMNI_CRYPTIC_GATEWAY // PROT_V2.6 ]
              </p>
            </div>
          </div>

          {/* Close Button cleanly positioned on the top-right */}
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl font-mono text-xs theme-text-muted hover:text-cyan-400 hover:theme-bg-surface transition-colors cursor-pointer border border-transparent hover:border-cyan-500/30 flex-shrink-0 ml-3"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body Container */}
        <div className="overflow-y-auto pr-1 flex-1">
          {/* Tab Switch */}
          <div className="flex theme-bg-surface p-1 rounded-xl border theme-border mb-4 text-xs sm:text-sm font-mono">
            <button
              type="button"
              onClick={() => { setTab('alumni'); setError(null); setNotRegistered(false); }}
              className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                tab === 'alumni' 
                  ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/50 shadow-sm' 
                  : 'theme-text-muted hover:text-cyan-600 dark:hover:text-cyan-400'
              }`}
            >
              [ ALUMNI ACCESS ]
            </button>
            <button
              type="button"
              onClick={() => { setTab('admin'); setError(null); setNotRegistered(false); }}
              className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer ${
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
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-mono mb-4 flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{recoverySuccess}</span>
            </div>
          )}

          {/* Not Found / Registration Guidance Card */}
          {notRegistered ? (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border-2 border-amber-500/40 text-xs sm:text-sm font-mono mb-4 space-y-2.5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                      Alumni Record Not Found
                    </p>
                    <p className="mt-0.5 text-xs theme-text-secondary leading-relaxed">
                      Your credentials were not found in the NetHunt roster. If you haven't registered for LOGIN 2026 yet, please complete official registration:
                    </p>
                  </div>
                </div>

                <a
                  href="https://login.psgtech.ac.in/alumni"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer group flex-shrink-0 whitespace-nowrap"
                >
                  <span>Register at Portal</span>
                  <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </div>

              <p className="text-[11px] theme-text-muted leading-tight pt-2 border-t border-amber-500/20">
                * Once registered, your record will be synchronized by the organizing team and you can sign in using your registered mobile number.
              </p>
            </div>
          ) : error ? (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-500 dark:text-rose-400 text-xs sm:text-sm font-mono flex items-center space-x-2 mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Recovery Form Mode */}
          {tab === 'recover' ? (
            <form onSubmit={handleRecoverPasskey} className="space-y-3.5 text-xs sm:text-sm">
              <div className="border-b theme-border pb-2 mb-1">
                <span className="font-mono font-bold text-xs sm:text-sm theme-heading-cyan uppercase">
                  &gt; SELF-SERVICE PASSWORD RECOVERY
                </span>
                <p className="text-xs theme-text-muted font-mono mt-0.5">
                  Enter your registered Email & Phone to reset your password back to your phone number.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                    data-allow-paste="true"
                    className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-sm focus:outline-none focus:border-cyan-400 font-mono shadow-inner transition-colors allow-paste select-text"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs font-bold uppercase tracking-wider theme-text-secondary mb-1">
                    &gt; REGISTERED MOBILE (10 DIGITS)
                  </label>
                  <input
                    type="text"
                    value={recoverPhone}
                    onChange={(e) => setRecoverPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    required
                    data-allow-paste="true"
                    className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-sm focus:outline-none focus:border-cyan-400 font-mono shadow-inner transition-colors allow-paste select-text"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-black text-xs sm:text-sm uppercase tracking-wider shadow-sm transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                {loading ? <span>[ VERIFYING... ]</span> : <span>[ RESET PASSWORD TO MOBILE ]</span>}
              </button>

              <div className="flex items-center justify-between pt-2.5 border-t theme-border mt-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => { setTab('alumni'); setError(null); setNotRegistered(false); }}
                  className="theme-text-muted hover:text-cyan-500 cursor-pointer font-bold"
                >
                  ← Back to Sign In
                </button>

                <a
                  href="https://login.psgtech.ac.in/alumni"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-600 dark:text-cyan-400 font-bold hover:underline inline-flex items-center space-x-1"
                >
                  <span>Register Profile</span>
                  <ExternalLink className="w-3.5 h-3.5 inline ml-0.5" />
                </a>
              </div>
            </form>
          ) : (
            /* Standard Login Form */
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs sm:text-sm">
              {tab === 'alumni' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-mono text-xs font-bold uppercase tracking-wider theme-text-secondary mb-1">
                        &gt; REGISTERED EMAIL OR MOBILE
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. 9876543210 or email"
                        required
                        data-allow-paste="true"
                        className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-sm focus:outline-none focus:border-cyan-400 font-mono shadow-inner transition-colors allow-paste select-text"
                        autoFocus
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-mono text-xs font-bold uppercase tracking-wider theme-text-secondary">
                          &gt; PASSWORD
                        </label>
                        <button
                          type="button"
                          onClick={() => { setTab('recover'); setError(null); setNotRegistered(false); }}
                          className="text-xs font-mono theme-label-cyan hover:underline cursor-pointer font-bold"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <input
                        type="password"
                        value={passkey}
                        onChange={(e) => setPasskey(e.target.value)}
                        placeholder="Default: registered phone"
                        required
                        data-allow-paste="true"
                        className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-sm focus:outline-none focus:border-cyan-400 font-mono shadow-inner transition-colors allow-paste select-text"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] theme-text-muted font-mono leading-relaxed">
                    * Registered alumni: Log in with your <span className="text-cyan-600 dark:text-cyan-400 font-bold">Email</span> or <span className="text-cyan-600 dark:text-cyan-400 font-bold">Mobile Number</span>. Default password is your <span className="text-cyan-600 dark:text-cyan-400 font-bold">Phone Number</span>. You will be prompted to set a personal password upon first login.
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 mt-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {loading ? <span>[ VERIFYING_CREDENTIALS... ]</span> : <span>[ INITIALIZE_SESSION ]</span>}
                  </button>

                  <div className="pt-2.5 text-center border-t theme-border mt-2">
                    <p className="text-xs font-mono theme-text-muted">
                      Not registered yet for LOGIN 2026?{' '}
                      <a
                        href="https://login.psgtech.ac.in/alumni"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-600 dark:text-cyan-400 font-bold hover:underline inline-flex items-center space-x-1"
                      >
                        <span>Register at login.psgtech.ac.in/alumni</span>
                        <ExternalLink className="w-3.5 h-3.5 inline ml-0.5" />
                      </a>
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-3.5">
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
                      data-allow-paste="true"
                      className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-sm focus:outline-none focus:border-amber-400 font-mono shadow-inner transition-colors allow-paste select-text"
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 mt-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {loading ? <span>[ VERIFYING_CREDENTIALS... ]</span> : <span>[ INITIALIZE_ADMIN_SESSION ]</span>}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
