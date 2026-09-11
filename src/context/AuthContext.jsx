import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('nethunt_alumni_token'));
  const [loading, setLoading] = useState(true);
  const [eventStatus, setEventStatus] = useState('active');
  const [leaderboardVisible, setLeaderboardVisible] = useState(true);
  const [eventStartDate, setEventStartDate] = useState('2026-09-12T09:00:00+05:30');
  const [eventEndDate, setEventEndDate] = useState('2026-09-18T09:00:00+05:30');
  const [eventWindow, setEventWindow] = useState('12 Sep 2026 (09:00 AM) – 18 Sep 2026 (09:00 AM)');
  const [isBeforeStart, setIsBeforeStart] = useState(false);
  const [isAfterEnd, setIsAfterEnd] = useState(false);
  const [timeUntilStartSeconds, setTimeUntilStartSeconds] = useState(0);
  const [timeUntilEndSeconds, setTimeUntilEndSeconds] = useState(0);

  const refreshEventStatus = async () => {
    try {
      const res = await fetch('/api/events/status');
      const d = await res.json();
      if (d?.status) setEventStatus(d.status);
      if (d?.leaderboardVisible !== undefined) setLeaderboardVisible(Boolean(d.leaderboardVisible));
      if (d?.eventStartDate) setEventStartDate(d.eventStartDate);
      if (d?.eventEndDate) setEventEndDate(d.eventEndDate);
      if (d?.eventWindow) setEventWindow(d.eventWindow);
      if (d?.isBeforeStart !== undefined) setIsBeforeStart(Boolean(d.isBeforeStart));
      if (d?.isAfterEnd !== undefined) setIsAfterEnd(Boolean(d.isAfterEnd));
      if (d?.timeUntilStartSeconds !== undefined) setTimeUntilStartSeconds(d.timeUntilStartSeconds);
      if (d?.timeUntilEndSeconds !== undefined) setTimeUntilEndSeconds(d.timeUntilEndSeconds);
    } catch (e) {}
  };

  const fetchProfile = async (authToken) => {
    if (!authToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('nethunt_alumni_token');
        setToken(null);
        setUser(null);
      }
    } catch (e) {
      console.error('Failed to authenticate session:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile(token);
  }, [token]);

  // Fetch initial event status and connect to SSE stream
  useEffect(() => {
    refreshEventStatus();

    const eventSource = new EventSource('/api/events/stream');

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'EVENT_STATUS_CHANGED' && data.payload?.status) {
          setEventStatus(data.payload.status);
        }
        if (data.type === 'LEADERBOARD_VISIBILITY_CHANGED' && data.payload?.visible !== undefined) {
          setLeaderboardVisible(Boolean(data.payload.visible));
        }
        if (data.type === 'EVENT_SCHEDULE_CHANGED' || data.type === 'EVENT_CONFIG_CHANGED') {
          refreshEventStatus();
        }
      } catch (err) {}
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const login = async (username, passkey) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, passkey })
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Authentication failed');
      err.data = data;
      err.notRegistered = Boolean(data.notRegistered);
      err.registerUrl = data.registerUrl;
      throw err;
    }
    localStorage.setItem('nethunt_alumni_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const adminLogin = async (adminKey) => {
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Admin verification failed');
    localStorage.setItem('nethunt_alumni_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('nethunt_alumni_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (e) {}
  };

  const updateUser = (fields) => {
    setUser(prev => prev ? ({ ...prev, ...fields }) : null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      adminLogin,
      logout,
      refreshUser,
      updateUser,
      eventStatus,
      setEventStatus,
      leaderboardVisible,
      setLeaderboardVisible,
      eventStartDate,
      eventEndDate,
      eventWindow,
      isBeforeStart,
      isAfterEnd,
      timeUntilStartSeconds,
      timeUntilEndSeconds,
      refreshEventStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
