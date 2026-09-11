import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { 
  Key, 
  HelpCircle, 
  Check, 
  Lock, 
  AlertTriangle, 
  Copy, 
  Sparkles, 
  ArrowRight,
  Trophy,
  Activity,
  Layers,
  Clock,
  Pause,
  Square,
  Maximize,
  Minimize,
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  X,
  ExternalLink
} from 'lucide-react';
import { useProctorGuard } from '../utils/useProctorGuard';
import { useDeviceGuard } from '../utils/deviceGuard';
import DeviceBlockedScreen from './DeviceBlockedScreen';
import TestStartBriefing from './TestStartBriefing';
import TestExpiredScreen from './TestExpiredScreen';

export default function HuntArena({ onOpenAuth, onNavigateToLeaderboard }) {
  const { user, token, refreshUser, eventStatus: authEventStatus, setEventStatus } = useAuth();

  const [currentNodeData, setCurrentNodeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answerInput, setAnswerInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [unlockingHint, setUnlockingHint] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Timed Test Session State
  const [startingTest, setStartingTest] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Proctoring & Fullscreen State
  const [adminFullscreenBypass, setAdminFullscreenBypass] = useState(false);
  const [proctorViolations, setProctorViolations] = useState(user?.tab_violations || 0);
  const [activeProctorAlert, setActiveProctorAlert] = useState(null);
  const alertTimerRef = useRef(null);

  // Device Integrity Guard (Restricted to Laptop & Desktop only)
  const deviceStatus = useDeviceGuard();
  const [adminDeviceBypass, setAdminDeviceBypass] = useState(false);
  const isDeviceBlocked = !deviceStatus.isAllowed && (user?.role !== 'admin' || !adminDeviceBypass);

  const inputRef = useRef(null);

  const effectiveStatus = currentNodeData?.eventStatus || authEventStatus || 'active';
  const isPaused = effectiveStatus === 'paused';
  const isEnded = effectiveStatus === 'ended' || effectiveStatus === 'stopped';

  const fetchCurrentNode = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/hunt/current-node', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.eventStatus && setEventStatus) {
        setEventStatus(data.eventStatus);
      }
      setCurrentNodeData(data);
      setFeedback(null);
    } catch (err) {
      console.error('Failed to load current node:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentNode();
  }, [token, user?.current_step]);

  // Sync tabViolations from user or currentNodeData
  useEffect(() => {
    if (currentNodeData?.tabViolations !== undefined) {
      setProctorViolations(currentNodeData.tabViolations);
    } else if (user?.tab_violations !== undefined) {
      setProctorViolations(user.tab_violations);
    }
  }, [currentNodeData?.tabViolations, user?.tab_violations]);

  // Sync real-time countdown timer from server
  useEffect(() => {
    if (currentNodeData?.timeRemainingSeconds !== undefined) {
      setTimeRemaining(currentNodeData.timeRemainingSeconds);
    }
  }, [currentNodeData?.timeRemainingSeconds]);

  // Local 1-second countdown tick
  useEffect(() => {
    if (timeRemaining === null || timeRemaining === undefined) return;
    if (timeRemaining <= 0) {
      if (currentNodeData?.testStarted && !currentNodeData?.isTimeExpired) {
        fetchCurrentNode();
      }
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          fetchCurrentNode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, currentNodeData?.testStarted, currentNodeData?.isTimeExpired]);

  const formatTime = (secs) => {
    if (secs === null || secs === undefined) return '--:--:--';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const handleStartTest = async () => {
    if (startingTest) return;
    setStartingTest(true);
    try {
      const res = await fetch('/api/hunt/start-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        await fetchCurrentNode();
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'Failed to start test session. Please retry.'
        });
      }
    } catch (err) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: 'Network error while initializing test session.'
      });
    } finally {
      setStartingTest(false);
    }
  };

  const handleViolation = (eventType, metadata, totalViolations) => {
    if (totalViolations !== undefined) {
      setProctorViolations(totalViolations);
    } else {
      setProctorViolations(prev => prev + 1);
    }

    let readableReason = 'Test integrity infraction recorded';
    if (eventType === 'FULLSCREEN_EXIT') readableReason = 'Fullscreen window exited during active hunt';
    else if (eventType === 'TAB_SWITCH') readableReason = 'Tab switch / backgrounding detected';
    else if (eventType === 'WINDOW_BLUR') readableReason = 'Window focus lost / Alt-Tab detected';
    else if (eventType === 'DEVTOOLS_SHORTCUT') readableReason = `DevTools shortcut [${metadata?.combo || metadata?.key || 'key'}] blocked`;
    else if (eventType === 'CLIPBOARD_PASTE_ATTEMPT') readableReason = 'Direct answer paste blocked';

    setActiveProctorAlert({
      type: eventType,
      reason: readableReason,
      timestamp: new Date().toLocaleTimeString()
    });

    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => {
      setActiveProctorAlert(null);
    }, 6500);
  };

  const proctoringEnabled = Boolean(
    token && 
    user && 
    (user.role !== 'admin' || !adminFullscreenBypass) && 
    !currentNodeData?.completed
  );

  const {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    reportProctorEvent
  } = useProctorGuard({
    enabled: proctoringEnabled,
    token,
    currentStep: currentNodeData?.stepIndex ?? user?.current_step,
    onViolation: handleViolation
  });

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setTimeout(() => setCooldownSeconds(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldownSeconds]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isPaused) {
      setFeedback({
        type: 'error',
        message: 'Event is currently paused by organizers. Submissions are temporarily on hold.'
      });
      return;
    }
    if (isEnded) {
      setFeedback({
        type: 'error',
        message: 'LOGIN Nethunt event has concluded. Submissions are closed.'
      });
      return;
    }
    if (!answerInput.trim() || submitting || cooldownSeconds > 0) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/hunt/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ answer: answerInput })
      });

      const data = await res.json();

      // Handle server rejection or status blocks
      if (!res.ok) {
        if (data.eventStatus && setEventStatus) {
          setEventStatus(data.eventStatus);
        }
        if (res.status === 429) {
          setFeedback({ type: 'error', message: data.error || 'Rate limit reached. Please wait.' });
          setCooldownSeconds(data.retryAfter || 60);
          return;
        }
        setFeedback({
          type: 'error',
          message: data.error || data.message || 'Verification failed. Review the cipher or unlock a progressive hint.'
        });
        return;
      }

      if (data.correct) {
        confetti({
          particleCount: 110,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#38bdf8', '#10b981']
        });

        setFeedback({
          type: 'success',
          message: data.message || 'Decryption verified! Advancing to next challenge.'
        });

        setAnswerInput('');
        await refreshUser();
        setTimeout(() => {
          fetchCurrentNode();
        }, 1200);
      } else if (data.isNearMiss) {
        setFeedback({
          type: 'near-miss',
          message: data.message
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.message || 'Verification failed. Review the cipher or unlock a progressive hint.'
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network connection failed. Please check connection.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockHint = async () => {
    if (!token || unlockingHint) return;
    if (isPaused) {
      setFeedback({
        type: 'error',
        message: 'Event is currently paused by organizers. Hint unlocks are temporarily on hold.'
      });
      return;
    }
    if (isEnded) {
      setFeedback({
        type: 'error',
        message: 'LOGIN Nethunt event has concluded. Hint unlocks are closed.'
      });
      return;
    }

    setUnlockingHint(true);
    try {
      const res = await fetch('/api/hunt/unlock-hint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        await fetchCurrentNode();
      } else {
        const d = await res.json().catch(() => ({}));
        if (d.eventStatus && setEventStatus) setEventStatus(d.eventStatus);
        setFeedback({
          type: 'error',
          message: d.error || d.message || 'Unable to unlock clue at this time.'
        });
      }
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', message: 'Network connection failed while unlocking clue.' });
    } finally {
      setUnlockingHint(false);
    }
  };

  const copyPayload = () => {
    if (node?.clue_payload) {
      navigator.clipboard.writeText(node.clue_payload);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }
  };

  // Strict Device Integrity Enforcement: Laptop or Desktop environment required
  if (isDeviceBlocked) {
    return (
      <DeviceBlockedScreen 
        deviceInfo={deviceStatus} 
        isAdmin={user?.role === 'admin'} 
        onAdminBypass={() => setAdminDeviceBypass(true)} 
      />
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24 flex flex-col items-center justify-center text-center">
        {/* Centered Crest Box */}
        <div className="bg-white p-4 rounded-2xl border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(0,240,255,0.25)] flex items-center justify-center mb-6 transition-transform hover:scale-105">
          <img 
            src="/psg_logo.png" 
            alt="PSG College of Technology Crest" 
            className="h-24 w-auto max-w-[100px] object-contain block mx-auto" 
          />
        </div>

        {/* Centered High-Contrast Badge */}
        <div className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full border border-sky-500/40 bg-sky-100 dark:bg-cyan-950/60 text-sky-950 dark:text-cyan-300 font-mono text-xs sm:text-sm font-bold shadow-sm mb-6">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
          <span className="tracking-wider">EVENT WINDOW: 11TH AUG 2026 – 17TH AUG 2026 // MCA ALUMNI CRYPTIC ODYSSEY</span>
        </div>

        {/* High-Contrast Centered Heading */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-mono font-black theme-text-primary mb-4 tracking-tight">
          LOGIN<span className="theme-heading-cyan">//2026</span> NETHUNT
        </h1>

        {/* Larger, High-Contrast Description */}
        <p className="theme-text-primary text-base sm:text-lg lg:text-xl font-mono max-w-2xl mx-auto mb-10 leading-relaxed opacity-95">
          Autonomous progressive cryptic puzzle arena exclusively for MCA Alumni of PSG College of Technology.
          Active from 11th Aug 2026 to 17th Aug 2026 • Desktop &amp; Laptop environments only.
        </p>

        {/* Prominent CTA */}
        <button
          onClick={onOpenAuth}
          className="px-10 py-5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-black text-sm sm:text-base uppercase tracking-wider shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:shadow-[0_0_35px_rgba(0,240,255,0.6)] transition-all flex items-center justify-center space-x-3 mx-auto cursor-pointer"
        >
          <span>[ INITIALIZE_SESSION // ENTER_PASSKEY ]</span>
          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Guidance for Unregistered Alumni */}
        <div className="mt-8 p-4 max-w-lg mx-auto rounded-2xl bg-cyan-950/20 border border-cyan-500/30">
          <p className="text-xs sm:text-sm font-mono theme-text-secondary">
            Alumni not found or not yet registered?
          </p>
          <a
            href="https://login.psgtech.ac.in/alumni"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 text-cyan-600 dark:text-cyan-400 font-bold hover:underline font-mono text-xs sm:text-sm mt-1.5"
          >
            <span>Register your profile at login.psgtech.ac.in/alumni</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  // Pre-test Briefing Gate: Participant must review rules & initialize timed session
  if (user && user.role !== 'admin' && !currentNodeData?.testStarted) {
    return (
      <TestStartBriefing 
        user={user}
        durationMinutes={currentNodeData?.totalDurationMinutes || 60}
        onStartTest={handleStartTest}
        loading={startingTest}
      />
    );
  }

  // Timed Session Expired Gate: All submissions locked
  if (user && user.role !== 'admin' && currentNodeData?.isTimeExpired) {
    return (
      <TestExpiredScreen 
        user={user}
        currentNodeData={currentNodeData}
        onNavigateToLeaderboard={onNavigateToLeaderboard}
      />
    );
  }

  // Trajectory Completed Screen
  if (currentNodeData?.completed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-24 h-24 mx-auto rounded-3xl bg-amber-500/20 border border-amber-500/60 text-amber-400 flex items-center justify-center text-4xl mb-6 shadow-[0_0_30px_rgba(255,176,0,0.3)] animate-pulse">
          <Trophy className="w-12 h-12" />
        </div>
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-950/40 text-amber-300 font-mono text-sm font-bold mb-4">
          <span>[ ALL NODES COMPLETED ]</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-mono font-black theme-text-primary mb-3">
          TRAJECTORY CONQUERED
        </h1>
        <p className="text-base font-mono theme-text-secondary mb-8">
          Congratulations {user.name} ({user.batch})! You have cracked every assigned cryptic node in your trajectory.
        </p>

        <div className="theme-bg-card border border-amber-500/30 p-6 rounded-2xl shadow-[0_0_20px_rgba(255,176,0,0.1)] mb-6 flex justify-around">
          <div>
            <p className="text-[11px] theme-text-muted font-mono uppercase tracking-wider">Final Score</p>
            <p className="text-3xl font-mono font-black text-amber-400 mt-1">{user.score} PTS</p>
          </div>
          <div className="w-[1px] bg-amber-500/20"></div>
          <div>
            <p className="text-[11px] theme-text-muted font-mono uppercase tracking-wider">Nodes Cleared</p>
            <p className="text-3xl font-mono font-black text-emerald-400 mt-1">{currentNodeData.totalSteps} / {currentNodeData.totalSteps}</p>
          </div>
        </div>

        <p className="text-xs theme-text-muted font-mono tracking-wide uppercase">
          DEPARTMENT OF COMPUTER APPLICATIONS • PSG COLLEGE OF TECHNOLOGY
        </p>
      </div>
    );
  }

  // Proctored Fullscreen Required Gate (Locks arena unless in fullscreen mode)
  if (proctoringEnabled && !isFullscreen && !(user?.role === 'admin' && adminFullscreenBypass)) {
    return (
      <div className="max-w-3xl mx-auto my-12 px-4">
        <div className="p-8 sm:p-12 rounded-3xl theme-bg-card border-2 border-amber-500/40 shadow-2xl space-y-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/15 border border-amber-500/40 text-amber-500 flex items-center justify-center shadow-lg">
            <ShieldAlert className="w-10 h-10 animate-pulse" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>SECURE TEST INTEGRITY PROTOCOL ACTIVE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-mono font-black theme-text-primary tracking-wide uppercase">
              FULLSCREEN MODE REQUIRED
            </h1>
            <p className="text-xs sm:text-sm font-mono theme-text-muted max-w-xl mx-auto leading-relaxed">
              &gt; To ensure absolute competitive fairness and prevent split-screen browsing or external AI copilots, LOGIN 2026 test nodes are accessible strictly in proctored fullscreen mode.
            </p>
          </div>

          {/* Infraction Warning Notice if violations exist */}
          {proctorViolations > 0 && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-500 dark:text-rose-300 font-mono text-xs text-left space-y-1.5 shadow-sm max-w-lg mx-auto">
              <div className="flex items-center space-x-2 font-bold uppercase">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>⚠️ INFRACTION WARNING // TELEMETRY RECORDED</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Your session has logged <strong className="font-bold underline">{proctorViolations} proctor infraction(s)</strong> (fullscreen exits, tab switches, or window blurs). All events are timestamped and reviewed by the Game Master staff.
              </p>
            </div>
          )}

          {/* Enter Fullscreen Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={enterFullscreen}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-mono font-black text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.35)] hover:shadow-[0_0_35px_rgba(245,158,11,0.5)] transition-all flex items-center justify-center space-x-3 cursor-pointer"
            >
              <Maximize className="w-5 h-5" />
              <span>[ ENTER FULLSCREEN TO ACCESS TEST ]</span>
            </button>

            {user?.role === 'admin' && (
              <button
                onClick={() => setAdminFullscreenBypass(true)}
                className="w-full sm:w-auto px-5 py-4 rounded-2xl border theme-border font-mono text-xs font-bold theme-text-muted hover:theme-text-primary hover:theme-bg-surface transition-all cursor-pointer"
              >
                [ ADMIN: BYPASS FULLSCREEN ]
              </button>
            )}
          </div>

          {/* Proctor Rules Brief */}
          <div className="border-t theme-border pt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left font-mono text-[11px] theme-text-muted">
            <div className="p-3 rounded-xl theme-bg-surface border theme-border space-y-1">
              <span className="font-bold theme-text-primary">&gt; FULLSCREEN ONLY</span>
              <p>Exiting fullscreen or resizing the window immediately locks the arena.</p>
            </div>
            <div className="p-3 rounded-xl theme-bg-surface border theme-border space-y-1">
              <span className="font-bold theme-text-primary">&gt; TAB SWITCHING</span>
              <p>Switching browser tabs or minimizing records a live proctor timestamp.</p>
            </div>
            <div className="p-3 rounded-xl theme-bg-surface border theme-border space-y-1">
              <span className="font-bold theme-text-primary">&gt; ALT-TAB DETECTION</span>
              <p>Clicking outside browser or switching applications flags window blur.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const node = currentNodeData?.node;
  const currentStep = currentNodeData?.currentStep || 0;
  const totalSteps = currentNodeData?.totalSteps || 12;

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Floating Proctor Alert Notification Toast */}
      {activeProctorAlert && (
        <div className="fixed top-20 right-4 z-50 max-w-md w-full p-4 rounded-2xl bg-rose-950/95 border-2 border-rose-500 text-rose-200 shadow-2xl flex items-start space-x-3 animate-pulse">
          <AlertOctagon className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1 font-mono">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs uppercase tracking-wider text-rose-300">
                ⚠️ PROCTOR INFRACTION LOGGED
              </span>
              <span className="text-[10px] opacity-75">{activeProctorAlert.timestamp}</span>
            </div>
            <p className="text-xs text-white font-sans font-medium">
              {activeProctorAlert.reason}
            </p>
            <p className="text-[10px] text-rose-300/80">
              Infraction recorded to Game Master audit trail. Total Infractions: {proctorViolations}
            </p>
          </div>
          <button
            onClick={() => setActiveProctorAlert(null)}
            className="text-rose-400 hover:text-white transition-colors cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Proctored Session Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl theme-bg-card border theme-border font-mono text-xs shadow-sm">
        <div className="flex items-center space-x-2.5">
          {isFullscreen ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-500 dark:text-emerald-400 font-bold tracking-wide">
                PROCTORED FULLSCREEN ACTIVE
              </span>
              <span className="theme-text-muted hidden sm:inline">&bull; Anti-tamper &amp; tab-switch detection running</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-amber-500 font-bold tracking-wide">
                [ ADMIN FULLSCREEN BYPASS ACTIVE ]
              </span>
            </>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {proctorViolations > 0 ? (
            <span className="px-3 py-1 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-500 dark:text-rose-300 font-bold flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{proctorViolations} INFRACTION(S) RECORDED</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>CLEAN INTEGRITY LOG</span>
            </span>
          )}

          {isFullscreen && (
            <button
              onClick={exitFullscreen}
              className="px-3 py-1 rounded-xl border theme-border theme-text-muted hover:theme-text-primary hover:theme-bg-surface transition-all text-[11px] font-bold cursor-pointer"
              title="Exiting fullscreen will lock the challenge arena until you return"
            >
              [ EXIT FULLSCREEN ]
            </button>
          )}

          {!isFullscreen && user?.role === 'admin' && adminFullscreenBypass && (
            <button
              onClick={() => setAdminFullscreenBypass(false)}
              className="px-3 py-1 rounded-xl border border-amber-500/40 text-amber-500 text-[11px] font-bold hover:bg-amber-500/10 transition-all cursor-pointer"
            >
              [ RE-ENFORCE FULLSCREEN ]
            </button>
          )}
        </div>
      </div>

      {/* Real-time Session Countdown Timer Header */}
      {timeRemaining !== null && timeRemaining !== undefined && (
        <div className={`p-4 sm:p-5 rounded-2xl border font-mono shadow-md flex flex-wrap items-center justify-between gap-4 transition-all ${
          timeRemaining <= 600
            ? 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-[0_0_30px_rgba(244,63,94,0.35)] animate-pulse'
            : timeRemaining <= 1800
              ? 'bg-amber-950/50 border-amber-500/60 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
              : 'theme-bg-card border-cyan-500/30 text-cyan-300'
        }`}>
          <div className="flex items-center space-x-3.5">
            <div className={`p-2.5 rounded-xl flex items-center justify-center ${
              timeRemaining <= 600
                ? 'bg-rose-500/20 text-rose-400'
                : timeRemaining <= 1800
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-cyan-500/15 text-cyan-400'
            }`}>
              <Clock className={`w-6 h-6 ${timeRemaining <= 600 ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <span>SESSION COUNTDOWN TIMER</span>
                {timeRemaining <= 600 && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500 text-white font-bold animate-bounce">
                    FINAL 10 MINS
                  </span>
                )}
                {timeRemaining <= 1800 && timeRemaining > 600 && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500 text-slate-950 font-bold">
                    &lt; 30 MINS
                  </span>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black tabular-nums tracking-wider text-white mt-0.5">
                {formatTime(timeRemaining)}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <span className="text-xs text-slate-400 block">TOTAL ALLOCATED</span>
              <span className="text-sm font-bold text-slate-200">
                {currentNodeData?.totalDurationMinutes || 120} MINUTES
              </span>
            </div>
            {/* Visual countdown progress bar */}
            <div className="w-32 sm:w-48 bg-slate-800 rounded-full h-3.5 overflow-hidden border border-slate-700">
              <div 
                className={`h-full transition-all duration-1000 ${
                  timeRemaining <= 600
                    ? 'bg-rose-500'
                    : timeRemaining <= 1800
                      ? 'bg-amber-500'
                      : 'bg-cyan-400'
                }`}
                style={{ 
                  width: `${Math.max(0, Math.min(100, (timeRemaining / ((currentNodeData?.totalDurationMinutes || 120) * 60)) * 100))}%` 
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Trajectory Step Progress Visualizer - Single-Line Formal Design */}
      <div className="theme-bg-card border theme-border p-5 rounded-2xl shadow-sm">
        <div className="flex flex-wrap items-center justify-between text-sm font-mono mb-3 gap-2">
          <div className="flex items-center space-x-2.5">
            <span className="font-bold theme-label-cyan tracking-wider text-sm">
              &gt; TRAJECTORY_PATH: <span className="theme-metric-value text-base font-black">STEP {currentStep + 1} OF {totalSteps}</span>
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
              {Math.round((currentStep / totalSteps) * 100)}% COMPLETED
            </span>
          </div>
          <div className="flex items-center space-x-5">
            <span className="theme-text-muted text-sm">
              RATE_LIMIT: <strong className="theme-label-cyan">5 ATTEMPTS / 60S</strong>
            </span>
            <span className="theme-text-muted text-sm">
              SCORE: <strong className="theme-metric-value text-base font-bold">{user.score || 0} PTS</strong>
            </span>
          </div>
        </div>

        {/* Unified Single-Line Segmented Progress Bar */}
        <div className="w-full flex items-center gap-1.5 sm:gap-2 py-1">
          {Array.from({ length: totalSteps }).map((_, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;

            return (
              <div
                key={idx}
                title={`Node ${idx + 1}: ${isCompleted ? 'Solved' : isCurrent ? 'Active Target' : 'Locked'}`}
                className={`relative flex-1 h-3.5 sm:h-4 rounded transition-all duration-300 flex items-center justify-center text-[10px] font-mono font-extrabold select-none ${
                  isCompleted
                    ? 'bg-emerald-500 border border-emerald-400 text-slate-950 shadow-sm'
                    : isCurrent
                    ? 'bg-cyan-500 dark:bg-cyan-400 border-2 border-cyan-300 dark:border-cyan-200 text-slate-950 shadow-[0_0_12px_rgba(0,240,255,0.4)] animate-pulse'
                    : 'theme-bg-surface border theme-border opacity-40 text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
                ) : isCurrent ? (
                  <span className="leading-none">{idx + 1}</span>
                ) : (
                  <span className="hidden md:inline leading-none opacity-50">{idx + 1}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Status Alert Banner */}
      {isPaused && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/15 border-2 border-amber-500/60 text-amber-300 font-mono shadow-[0_0_25px_rgba(245,158,11,0.25)] flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex-shrink-0">
              <Pause className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base tracking-wider uppercase text-amber-300 flex items-center space-x-2">
                <span>[ EVENT STATUS // TEMPORARILY PAUSED ]</span>
              </div>
              <div className="text-xs sm:text-sm text-amber-200/90 font-sans mt-0.5 leading-relaxed">
                The Game Master has paused the hunt. Challenge decryption submissions and progressive clue unlocks are temporarily on hold. Stand by for resumption.
              </div>
            </div>
          </div>
          <span className="text-[11px] px-3 py-1 rounded-lg bg-amber-500/25 text-amber-300 font-bold border border-amber-500/50 uppercase tracking-widest hidden sm:inline-block flex-shrink-0">
            PAUSED
          </span>
        </div>
      )}

      {isEnded && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/15 border-2 border-rose-500/60 text-rose-300 font-mono shadow-[0_0_25px_rgba(244,63,94,0.25)] flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex-shrink-0">
              <Square className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base tracking-wider uppercase text-rose-300 flex items-center space-x-2">
                <span>[ EVENT CONCLUDED // STOPPED ]</span>
              </div>
              <div className="text-xs sm:text-sm text-rose-200/90 font-sans mt-0.5 leading-relaxed">
                The LOGIN 2026 Nethunt has officially concluded. Submissions and clue unlocks are closed. View the final alumni rankings in the Standings tab.
              </div>
            </div>
          </div>
          <span className="text-[11px] px-3 py-1 rounded-lg bg-rose-500/25 text-rose-300 font-bold border border-rose-500/50 uppercase tracking-widest hidden sm:inline-block flex-shrink-0">
            CONCLUDED
          </span>
        </div>
      )}

      {/* Main Dual-Column Cryptic Terminal Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left / Center: Cryptic Node & Answer Console (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="theme-bg-card border theme-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            
            {/* Node Metadata Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b theme-border pb-4">
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40">
                  {node?.tier || 'Foundation'}
                </span>
                <span className="px-3 py-1 rounded-lg text-xs font-mono font-semibold uppercase tracking-wider theme-bg-surface theme-text-secondary border theme-border">
                  {node?.domain || 'Cryptology'}
                </span>
                <span className="text-sm font-mono font-bold theme-label-cyan">
                  [ {node?.code} ]
                </span>
              </div>

              <div className="text-sm font-mono">
                <span className="theme-text-muted">MAX POTENTIAL: </span>
                <strong className="theme-metric-value text-base font-bold">{node?.currentPotentialPoints} PTS</strong>
              </div>
            </div>

            {/* Title */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-mono font-black theme-text-primary tracking-tight">
                {node?.title || 'Loading Node...'}
              </h2>
            </div>

            {/* Narrative Context Lore */}
            <div className="theme-bg-surface border theme-border rounded-xl p-4 sm:p-5 text-sm sm:text-base theme-text-secondary leading-relaxed font-mono">
              <span className="theme-label-cyan font-bold block mb-1 text-xs sm:text-sm">&gt; LOG_ARCHIVE:</span>
              <p className="italic">
                "{node?.story}"
              </p>
            </div>

            {/* Clue Description */}
            <div className="space-y-4 font-mono">
              <div className="text-base sm:text-lg theme-text-primary font-normal leading-relaxed whitespace-pre-line">
                {node?.clue_text}
              </div>

              {/* Visual Image Clue if media_url provided */}
              {node?.media_url && (
                <div className="rounded-2xl border-2 border-cyan-500/40 overflow-hidden shadow-2xl bg-slate-950 p-4 text-center my-4">
                  <img 
                    src={node.media_url} 
                    alt={node.title || "Cryptic visual cipher"} 
                    className="max-h-[420px] max-w-full mx-auto object-contain rounded-xl shadow-lg transition-transform hover:scale-[1.01]"
                  />
                  <span className="block mt-2 text-xs font-mono text-cyan-400/80">
                    &gt; VISUAL CIPHER // EXAMINE REBUS DETAILS CAREFULLY
                  </span>
                </div>
              )}

              {/* Code Payload Box */}
              {node?.clue_payload && (
                <div className="relative group rounded-xl border border-cyan-500/40 overflow-hidden shadow-2xl">
                  <div className="bg-slate-950 border-b border-cyan-500/30 px-4 py-2.5 flex items-center justify-between text-xs font-mono">
                    <span className="text-cyan-400 font-bold flex items-center space-x-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                      <span>&gt; CAT PAYLOAD.TXT</span>
                    </span>
                    <button
                      onClick={copyPayload}
                      data-allow-copy="true"
                      title="Copy payload"
                      className="px-3 py-1.5 rounded-lg bg-cyan-950 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition-all text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedPayload ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>
                  <pre 
                    data-allow-copy="true"
                    className="terminal-payload-box p-4 font-mono text-sm sm:text-base overflow-x-auto whitespace-pre-wrap leading-relaxed allow-copy select-text"
                  >
                    <code data-allow-copy="true" className="allow-copy select-text">{node.clue_payload}</code>
                  </pre>
                </div>
              )}
            </div>

            {/* Feedback Alert */}
            {feedback && (
              <div className={`p-4 rounded-xl text-sm sm:text-base font-mono border transition-all ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(0,255,102,0.15)]'
                  : feedback.type === 'near-miss'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-[0_0_15px_rgba(255,176,0,0.15)]'
                  : 'bg-rose-500/10 border-rose-500/40 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
              }`}>
                <p className="font-bold">&gt; {feedback.message}</p>
                {feedback.type === 'near-miss' && (
                  <p className="text-xs sm:text-sm opacity-90 mt-1">
                    * Proximity detection triggered: Exceptionally close. Re-verify exact casing or character order.
                  </p>
                )}
              </div>
            )}

            {/* Answer Input Console */}
            <form onSubmit={handleSubmit} className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cyan-600 dark:text-cyan-400">
                    <Key className="w-5 h-5" />
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    onPaste={(e) => {
                      e.preventDefault();
                      reportProctorEvent('CLIPBOARD_PASTE_ATTEMPT', { target: 'answer_input' });
                      setFeedback({
                        type: 'error',
                        message: '🔒 Clipboard paste disabled. Manual character entry required in the arena.'
                      });
                    }}
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    placeholder={
                      isPaused
                        ? "[ HUNT PAUSED - SUBMISSIONS ON HOLD ]"
                        : isEnded
                        ? "[ HUNT CONCLUDED - SUBMISSIONS CLOSED ]"
                        : "Enter decrypted key, keyword, or number..."
                    }
                    disabled={submitting || isPaused || isEnded || cooldownSeconds > 0}
                    className={`w-full pl-11 pr-4 py-4 rounded-xl theme-bg-surface border font-mono text-base focus:outline-none transition-all shadow-inner ${
                      isPaused
                        ? 'border-amber-500/50 bg-amber-500/5 text-amber-200 placeholder:text-amber-400/60 opacity-80 cursor-not-allowed'
                        : isEnded
                        ? 'border-rose-500/50 bg-rose-500/5 text-rose-200 placeholder:text-rose-400/60 opacity-80 cursor-not-allowed'
                        : 'theme-border theme-text-primary placeholder:theme-text-muted focus:border-cyan-400 disabled:opacity-50'
                    }`}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || isPaused || isEnded || !answerInput.trim() || cooldownSeconds > 0}
                  className={`px-8 py-4 rounded-xl font-mono font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center space-x-2 flex-shrink-0 ${
                    isPaused
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-not-allowed opacity-80'
                      : isEnded
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-not-allowed opacity-80'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.25)] disabled:opacity-50 cursor-pointer'
                  }`}
                >
                  {isPaused ? (
                    <span>[ PAUSED ]</span>
                  ) : isEnded ? (
                    <span>[ CONCLUDED ]</span>
                  ) : submitting ? (
                    <span>[ VERIFYING... ]</span>
                  ) : cooldownSeconds > 0 ? (
                    <span>[ COOLDOWN {cooldownSeconds}S ]</span>
                  ) : (
                    <>
                      <span>[ EXECUTE_DECRYPT ]</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs theme-text-muted font-mono px-1 gap-2">
                <span>&gt; Case-insensitive & normalized verification</span>
                <span>
                  {isPaused ? (
                    <strong className="text-amber-400">&gt; SUBMISSIONS PAUSED BY GAME MASTER</strong>
                  ) : isEnded ? (
                    <strong className="text-rose-400">&gt; EVENT CONCLUDED - SUBMISSIONS CLOSED</strong>
                  ) : (
                    "&gt; Rate limit: sliding 5 attempts / 60s"
                  )}
                </span>
              </div>
            </form>

          </div>
        </div>

        {/* Right: 7-Stage Progressive Hint Decay Engine (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <div className="theme-bg-card border theme-border rounded-2xl p-6 shadow-sm space-y-5">
            
            {/* Header */}
            <div>
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <h3 className="font-mono font-bold text-base tracking-wider theme-text-primary uppercase">
                  PROGRESSIVE DECAY MATRIX
                </h3>
              </div>
              <p className="text-xs sm:text-sm theme-text-muted font-mono mt-1.5 leading-relaxed">
                6 to 7 progressive, layered clues. Each unlocked hint decays potential node reward.
              </p>
            </div>

            {/* Potential Points Meter */}
            <div className="theme-bg-surface border theme-border p-4 rounded-xl space-y-2">
              <div className="flex justify-between items-baseline text-xs font-mono">
                <span className="theme-text-secondary">AVAILABLE REWARD</span>
                <span className="text-base font-black theme-metric-value font-mono">
                  {node?.currentPotentialPoints} / {node?.basePoints} PTS
                </span>
              </div>

              {/* Decay Bar */}
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-cyan-500/20">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-cyan-300 h-2 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,240,255,0.5)]"
                  style={{ width: `${Math.round(((node?.currentPotentialPoints || 0) / (node?.basePoints || 1000)) * 100)}%` }}
                ></div>
              </div>

              <div className="flex justify-between text-[11px] theme-text-muted font-mono">
                <span>{node?.hintsUnlockedCount || 0} OF {node?.totalHintsAvailable || 7} UNLOCKED</span>
                <span>DECAY ENGINE</span>
              </div>
            </div>

            {/* Unlocked Hints List */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {node?.unlockedHints?.length > 0 ? (
                node.unlockedHints.map((h) => (
                  <div key={h.hintNumber} className="theme-bg-surface border theme-border rounded-xl p-3.5 space-y-1 font-mono">
                    <span className="text-[11px] font-bold theme-label-cyan uppercase">
                      &gt; STAGE {h.hintNumber} CLUE:
                    </span>
                    <p className="text-xs theme-text-secondary leading-relaxed font-sans">
                      {h.text}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-5 rounded-xl border border-dashed theme-border text-center text-xs theme-text-muted font-mono">
                  No clues unlocked yet. Crack with 0 clues for full 1000 points!
                </div>
              )}
            </div>

            {/* Unlock Next Hint Action */}
            {node?.hintsUnlockedCount < node?.totalHintsAvailable ? (
              <button
                type="button"
                onClick={handleUnlockHint}
                disabled={unlockingHint || isPaused || isEnded}
                className={`w-full py-3 rounded-xl border font-bold text-xs font-mono transition-all flex items-center justify-center space-x-2 ${
                  isPaused
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300/80 cursor-not-allowed'
                    : isEnded
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-300/80 cursor-not-allowed'
                    : 'border-cyan-500/50 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-600 dark:text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.15)] cursor-pointer'
                }`}
              >
                <span>
                  {isPaused
                    ? '[ HINT UNLOCKS PAUSED ]'
                    : isEnded
                    ? '[ HINT UNLOCKS CLOSED ]'
                    : unlockingHint 
                    ? '[ DECRYPTING_CLUE... ]' 
                    : `[ UNLOCK STAGE ${(node?.hintsUnlockedCount || 0) + 1} CLUE ]`}
                </span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/60 text-center text-xs theme-text-muted font-mono border theme-border">
                ALL HINT STAGES UNLOCKED
              </div>
            )}

            {/* Point Degradation Multipliers */}
            <div className="border-t theme-border pt-3">
              <p className="text-[11px] theme-text-muted font-mono uppercase tracking-wider mb-2">
                DECAY MULTIPLIERS
              </p>
              <div className="grid grid-cols-4 gap-1 text-[11px] font-mono text-center">
                <span className="theme-bg-surface py-1 rounded theme-text-muted">H0: 1000</span>
                <span className="theme-bg-surface py-1 rounded theme-text-muted">H1: 850</span>
                <span className="theme-bg-surface py-1 rounded theme-text-muted">H2: 720</span>
                <span className="theme-bg-surface py-1 rounded theme-text-muted">H3: 600</span>
                <span className="theme-bg-surface py-1 rounded theme-text-muted">H4: 490</span>
                <span className="theme-bg-surface py-1 rounded theme-text-muted">H5: 390</span>
                <span className="theme-bg-surface py-1 rounded theme-text-muted">H6: 300</span>
                <span className="theme-bg-surface py-1 rounded theme-text-muted">H7: 220</span>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
