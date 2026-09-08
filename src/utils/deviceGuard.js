// Device Integrity Guard for NetHunt LOGIN 2026
// Restricts test access exclusively to Laptop and Desktop environments.
// Blocks smartphones, tablets, touch-only mobile devices, and compact displays (< 1024px).

import { useState, useEffect } from 'react';

/**
 * Evaluates the client hardware, pointer capabilities, screen resolution, and user agent.
 * @returns {{ isAllowed: boolean, deviceType: string, reason: string, resolution: string }}
 */
export function checkDeviceEnvironment() {
  if (typeof window === 'undefined') {
    return { isAllowed: true, deviceType: 'unknown', reason: '', resolution: 'N/A' };
  }

  const ua = navigator.userAgent || navigator.vendor || window.opera || '';

  // 1. Explicit Mobile OS / Phone detection
  const isMobilePhoneUA = /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS|FxiOS/i.test(ua);
  if (isMobilePhoneUA) {
    return {
      isAllowed: false,
      deviceType: 'mobile',
      reason: 'Mobile smartphone detected via client user agent.',
      resolution: `${window.innerWidth}x${window.innerHeight}`
    };
  }

  // 2. Tablet detection (including iPadOS Desktop Safari mode)
  const isIPad = /iPad/i.test(ua) || (
    navigator.platform === 'MacIntel' &&
    navigator.maxTouchPoints > 1 &&
    !window.MSStream
  );
  const isTabletUA = /Tablet|Silk|Kindle|PlayBook|Android(?!.*Mobile)/i.test(ua) || isIPad;
  if (isTabletUA) {
    return {
      isAllowed: false,
      deviceType: 'tablet',
      reason: 'Tablet device detected. Fullscreen proctored exams require a laptop or desktop computer.',
      resolution: `${window.innerWidth}x${window.innerHeight}`
    };
  }

  // 3. Client Hints / UserAgentData (Chromium-based mobile browsers)
  if (navigator.userAgentData?.mobile) {
    return {
      isAllowed: false,
      deviceType: 'mobile',
      reason: 'Mobile client confirmed via browser Client Hints.',
      resolution: `${window.innerWidth}x${window.innerHeight}`
    };
  }

  // 4. Physical Screen / Window Resolution Check
  const minDim = Math.min(window.innerWidth, window.innerHeight);

  // Modern laptops have at least 1024px horizontal resolution
  if (window.innerWidth < 1024 || minDim < 550) {
    return {
      isAllowed: false,
      deviceType: 'compact',
      reason: `Window width (${window.innerWidth}px) is below the required desktop/laptop minimum of 1024px.`,
      resolution: `${window.innerWidth}x${window.innerHeight}`
    };
  }

  // 5. Coarse Pointer / Touch-only check
  // True laptops/desktops feature a fine pointer (mouse / trackpad).
  // A device with ONLY coarse pointer and no fine pointer is a mobile/tablet.
  const hasFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  const hasCoarseOnly = window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !hasFinePointer;
  if (hasCoarseOnly) {
    return {
      isAllowed: false,
      deviceType: 'touch',
      reason: 'Touch-only primary input detected. Physical keyboard and mouse/trackpad required.',
      resolution: `${window.innerWidth}x${window.innerHeight}`
    };
  }

  return {
    isAllowed: true,
    deviceType: 'desktop',
    reason: '',
    resolution: `${window.innerWidth}x${window.innerHeight}`
  };
}

/**
 * React hook that actively listens to resize and orientation changes
 * to keep device compliance up to date.
 */
export function useDeviceGuard() {
  const [deviceStatus, setDeviceStatus] = useState(() => checkDeviceEnvironment());

  useEffect(() => {
    const handleResizeOrChange = () => {
      setDeviceStatus(checkDeviceEnvironment());
    };

    window.addEventListener('resize', handleResizeOrChange);
    window.addEventListener('orientationchange', handleResizeOrChange);

    return () => {
      window.removeEventListener('resize', handleResizeOrChange);
      window.removeEventListener('orientationchange', handleResizeOrChange);
    };
  }, []);

  return deviceStatus;
}
