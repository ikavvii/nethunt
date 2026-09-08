import React, { useState } from 'react';
import { Laptop, ShieldAlert, Smartphone, Copy, Check, AlertTriangle } from 'lucide-react';

export default function DeviceBlockedScreen({ deviceInfo, onAdminBypass, isAdmin }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      // fallback
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 text-center select-none font-mono">
      <div className="max-w-2xl w-full p-8 sm:p-10 rounded-3xl theme-bg-card border-2 border-rose-500/50 shadow-[0_0_50px_rgba(244,63,94,0.25)] space-y-6 animate-in fade-in zoom-in duration-300">
        
        {/* Hardware Icon Box */}
        <div className="relative mx-auto w-24 h-24 rounded-3xl bg-rose-500/15 border-2 border-rose-500/60 flex items-center justify-center text-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
          <Laptop className="w-12 h-12" />
          <div className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-slate-950 border border-rose-500/80 text-rose-400">
            <Smartphone className="w-5 h-5 line-through opacity-70" />
          </div>
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 text-rose-400 text-xs font-bold uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 animate-pulse" />
          <span>DEVICE_INTEGRITY_VIOLATION // NON-DESKTOP_BLOCKED</span>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black theme-text-primary tracking-tight uppercase">
            LAPTOP OR DESKTOP REQUIRED
          </h1>
          <p className="text-xs sm:text-sm text-rose-400 font-bold mt-1 tracking-wider uppercase">
            LOGIN 2026 TEST INTEGRITY PROTOCOL
          </p>
        </div>

        {/* Explanation */}
        <p className="theme-text-secondary text-xs sm:text-sm leading-relaxed font-sans max-w-lg mx-auto">
          The LOGIN 2026 NetHunt test can <strong className="theme-text-primary font-bold">only be taken on a Laptop or Desktop computer</strong>. 
          Access from smartphones, tablets, or compact mobile screens is strictly blocked to maintain full-screen proctoring and equal test conditions.
        </p>

        {/* Device Diagnostics Box */}
        <div className="p-4 rounded-2xl theme-bg-surface border theme-border text-left text-xs space-y-2">
          <div className="flex items-center justify-between border-b theme-border pb-2">
            <span className="theme-text-muted uppercase tracking-wider">&gt; DETECTED_ENVIRONMENT:</span>
            <span className="text-rose-400 font-bold uppercase">{deviceInfo?.deviceType || 'NON-DESKTOP'}</span>
          </div>
          <div className="flex items-center justify-between border-b theme-border pb-2">
            <span className="theme-text-muted uppercase tracking-wider">&gt; VIEWPORT_DIMENSIONS:</span>
            <span className="theme-text-primary font-bold">{deviceInfo?.resolution || 'N/A'}</span>
          </div>
          <div className="flex items-start justify-between gap-4 pt-1">
            <span className="theme-text-muted uppercase tracking-wider flex-shrink-0">&gt; DIAGNOSTICS:</span>
            <span className="theme-text-secondary text-right text-[11px] leading-tight">
              {deviceInfo?.reason || 'Mobile or compact viewport detected.'}
            </span>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3 pt-2">
          <p className="text-xs theme-text-muted">
            Please switch to your laptop or desktop computer to access and take the test.
          </p>

          <button
            onClick={handleCopyLink}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl border theme-border theme-bg-surface hover:theme-bg-page theme-text-primary text-xs font-bold transition-all flex items-center justify-center space-x-2 mx-auto cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">TEST LINK COPIED TO CLIPBOARD</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-cyan-400" />
                <span>COPY TEST URL TO OPEN ON LAPTOP</span>
              </>
            )}
          </button>
        </div>

        {/* Admin Bypass Option */}
        {isAdmin && (
          <div className="border-t theme-border pt-4">
            <button
              onClick={onAdminBypass}
              className="px-4 py-2 rounded-lg border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 text-[11px] font-bold transition-all cursor-pointer"
            >
              [ ADMIN: BYPASS DEVICE RESTRICTION ]
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
