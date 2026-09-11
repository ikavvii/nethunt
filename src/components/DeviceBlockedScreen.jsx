import React, { useState } from 'react';
import { Laptop, ShieldAlert, Smartphone, Copy, Check, Trophy, Share2, ExternalLink } from 'lucide-react';
import { formatShortEventWindow } from '../utils/dateUtils';

export default function DeviceBlockedScreen({ 
  deviceInfo, 
  onAdminBypass, 
  isAdmin, 
  onNavigateToLeaderboard,
  eventWindow,
  eventStartDate,
  eventEndDate 
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      // fallback
    }
  };

  const handleShareToWhatsApp = () => {
    const text = encodeURIComponent(
      `LOGIN 2026 NetHunt Test Access:\n${window.location.origin}\n\n*Note*: Please open this test link on your Laptop or Desktop computer to begin your session.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const scheduleText = eventWindow || formatShortEventWindow(eventStartDate, eventEndDate);

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-3 sm:px-4 py-8 sm:py-12 text-center select-none font-mono">
      <div className="max-w-xl w-full p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl theme-bg-card border-2 border-rose-500/50 shadow-[0_0_50px_rgba(244,63,94,0.25)] space-y-5 sm:space-y-6 animate-in fade-in zoom-in duration-300">
        
        {/* Hardware Icon Box */}
        <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-rose-500/15 border-2 border-rose-500/60 flex items-center justify-center text-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
          <Laptop className="w-10 h-10 sm:w-12 sm:h-12" />
          <div className="absolute -bottom-2 -right-2 p-1.5 sm:p-2 rounded-xl bg-slate-950 border border-rose-500/80 text-rose-400">
            <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 line-through opacity-70" />
          </div>
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center space-x-2 px-3 sm:px-4 py-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 animate-pulse" />
          <span className="truncate">INTEGRITY PROTOCOL // LAPTOP REQUIRED</span>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black theme-text-primary tracking-tight uppercase">
            LAPTOP OR DESKTOP REQUIRED
          </h1>
          <p className="text-[11px] sm:text-xs text-rose-400 font-bold mt-1 tracking-wider uppercase">
            LOGIN 2026 TEST INTEGRITY PROTOCOL
          </p>
          {scheduleText && (
            <div className="mt-2 inline-block px-3 py-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-[11px] font-bold">
              WINDOW: {scheduleText}
            </div>
          )}
        </div>

        {/* Explanation */}
        <p className="theme-text-secondary text-xs sm:text-sm leading-relaxed font-sans max-w-md mx-auto">
          The LOGIN 2026 NetHunt test can <strong className="theme-text-primary font-bold">only be taken on a Laptop or Desktop computer</strong>. 
          Smartphones and compact mobile screens are restricted to enforce proctoring, full-screen mode, and equal conditions.
        </p>

        {/* Device Diagnostics Box */}
        <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl theme-bg-surface border theme-border text-left text-xs space-y-2">
          <div className="flex items-center justify-between border-b theme-border pb-1.5">
            <span className="theme-text-muted uppercase text-[11px]">&gt; DETECTED_DEVICE:</span>
            <span className="text-rose-400 font-bold uppercase text-[11px]">{deviceInfo?.deviceType || 'NON-DESKTOP'}</span>
          </div>
          <div className="flex items-center justify-between border-b theme-border pb-1.5">
            <span className="theme-text-muted uppercase text-[11px]">&gt; VIEWPORT:</span>
            <span className="theme-text-primary font-bold text-[11px]">{deviceInfo?.resolution || 'N/A'}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pt-0.5">
            <span className="theme-text-muted uppercase text-[11px]">&gt; STATUS:</span>
            <span className="theme-text-secondary text-[11px]">
              {deviceInfo?.reason || 'Mobile or compact viewport detected.'}
            </span>
          </div>
        </div>

        {/* Action Buttons for Mobile Users */}
        <div className="space-y-3 pt-2">
          <p className="text-[11px] sm:text-xs theme-text-muted font-mono">
            Forward this link to your computer or view standings:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* WhatsApp Forward Button */}
            <button
              onClick={handleShareToWhatsApp}
              className="w-full px-4 py-3 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
            >
              <Share2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>SEND VIA WHATSAPP</span>
            </button>

            {/* Copy Link Button */}
            <button
              onClick={handleCopyLink}
              className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-surface hover:theme-bg-page theme-text-primary text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-emerald-400">URL COPIED!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>COPY TEST LINK</span>
                </>
              )}
            </button>
          </div>

          {/* Standings Navigation on Mobile */}
          {onNavigateToLeaderboard && (
            <button
              onClick={onNavigateToLeaderboard}
              className="w-full px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
            >
              <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span>VIEW LIVE ALUMNI STANDINGS</span>
            </button>
          )}
        </div>

        {/* Guidance for Unregistered Alumni */}
        <div className="pt-2 border-t theme-border text-[11px] theme-text-muted font-sans">
          <span>Not yet registered? </span>
          <a
            href="https://login.psgtech.ac.in/alumni"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 font-bold hover:underline inline-flex items-center space-x-1"
          >
            <span>Register your profile</span>
            <ExternalLink className="w-3 h-3 inline" />
          </a>
        </div>

        {/* Admin Bypass Option */}
        {isAdmin && (
          <div className="border-t theme-border pt-3">
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
