import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('nethunt_alumni_token'));
  const [loading, setLoading] = useState(true);
  const [eventStatus, setEventStatus] = useState('active');
  const [leaderboardVisible, setLeaderboardVisible] = useState(true);

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
    fetch('/api/events/status')
      .then(r => r.json())
      .then(d => {
        if (d?.status) setEventStatus(d.status);
        if (d?.leaderboardVisible !== undefined) setLeaderboardVisible(Boolean(d.leaderboardVisible));
      })
      .catch(() => {});

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
      setLeaderboardVisible
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
