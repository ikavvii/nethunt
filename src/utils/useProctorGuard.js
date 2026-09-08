import { useState, useEffect, useRef, useCallback } from 'react';

export function isBrowserFullscreen() {
  return Boolean(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
}

export function useProctorGuard({
  enabled = true,
  token,
  currentStep = 0,
  onViolation
}) {
  const [isFullscreen, setIsFullscreen] = useState(isBrowserFullscreen());
  const lastLoggedTimesRef = useRef({});
  const wasFullscreenRef = useRef(isBrowserFullscreen());

  const reportProctorEvent = useCallback(async (eventType, metadata = {}) => {
    if (!token) return;

    // Deduplicate identical events firing within 1.2 seconds (e.g. blur + visibility hidden surge)
    const now = Date.now();
    const lastTime = lastLoggedTimesRef.current[eventType] || 0;
    if (now - lastTime < 1200) {
      return;
    }
    lastLoggedTimesRef.current[eventType] = now;

    try {
      const res = await fetch('/api/hunt/proctor-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          event_type: eventType,
          metadata: {
            ...metadata,
            clientTimestamp: now,
            stepIndex: currentStep
          }
        })
      });
      const data = await res.json();
      if (onViolation) {
        onViolation(eventType, metadata, data.totalViolations);
      }
      return data;
    } catch (err) {
      console.error('Failed to log proctor event:', err);
    }
  }, [token, currentStep, onViolation]);

  const enterFullscreen = async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
      setIsFullscreen(true);
      wasFullscreenRef.current = true;
    } catch (err) {
      console.warn('Unable to enter fullscreen mode:', err);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
      setIsFullscreen(false);
      wasFullscreenRef.current = false;
    } catch (err) {}
  };

  useEffect(() => {
    if (!enabled) return;

    const handleFullscreenChange = () => {
      const active = isBrowserFullscreen();
      setIsFullscreen(active);

      // If user was previously in fullscreen and just exited, log infraction
      if (wasFullscreenRef.current && !active) {
        reportProctorEvent('FULLSCREEN_EXIT', {
          reason: 'User exited fullscreen window during active hunt solve'
        });
      }
      wasFullscreenRef.current = active;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        reportProctorEvent('TAB_SWITCH', {
          reason: 'Browser tab lost visibility (switched tabs or minimized)'
        });
      }
    };

    const handleWindowBlur = () => {
      // Window blur while still visible indicates Alt-Tab, second monitor click, or application change
      reportProctorEvent('WINDOW_BLUR', {
        reason: 'Window lost focus (Alt-Tab or desktop interaction detected)',
        visibility: document.visibilityState
      });
    };

    const handleKeyDown = (e) => {
      // Intercept DevTools shortcuts: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
      const isF12 = e.key === 'F12' || e.keyCode === 123;
      const isInspect = (e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key);
      const isViewSource = (e.ctrlKey || e.metaKey) && ['U', 'u'].includes(e.key);

      if (isF12 || isInspect || isViewSource) {
        e.preventDefault();
        e.stopPropagation();
        const combo = `${e.ctrlKey || e.metaKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`;
        reportProctorEvent('DEVTOOLS_SHORTCUT', {
          combo,
          key: e.key
        });
      }
    };

    // Fullscreen listeners
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Tab switch / Visibility listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Alt-Tab / Window blur listeners
    window.addEventListener('blur', handleWindowBlur);

    // DevTools shortcut listeners
    window.addEventListener('keydown', handleKeyDown, true);

    // Initial check
    setIsFullscreen(isBrowserFullscreen());
    wasFullscreenRef.current = isBrowserFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, reportProctorEvent]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    reportProctorEvent
  };
}
