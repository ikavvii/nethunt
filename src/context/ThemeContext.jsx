import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const THEMES = [
  {
    id: 'cyber',
    name: 'Cyber Cyan',
    tag: 'NEUROMANCER VOID',
    mode: 'dark',
    color: '#00f0ff',
    bg: '#050811',
    cardBg: '#0a101f',
    description: 'Deep void black with high-voltage electric cyan & violet telemetry.'
  },
  {
    id: 'matrix',
    name: 'Phosphor Green',
    tag: 'VT100 MAINFRAME',
    mode: 'dark',
    color: '#00ff66',
    bg: '#030d06',
    cardBg: '#07170c',
    description: 'Monochrome cathode ray tube phosphor green with scanline aesthetics.'
  },
  {
    id: 'amber',
    name: 'Amber CRT',
    tag: 'DEC VT220 RETRO',
    mode: 'dark',
    color: '#ffb000',
    bg: '#0d0903',
    cardBg: '#1a1306',
    description: 'Vintage amber terminal glow inspired by late 70s mainframe consoles.'
  },
  {
    id: 'synthwave',
    name: 'Neon Synthwave',
    tag: 'OUTRUN 1984',
    mode: 'dark',
    color: '#ff2a8d',
    bg: '#090414',
    cardBg: '#130924',
    description: 'Vibrant neon magenta and cyan highlights over deep ultraviolet obsidian.'
  },
  {
    id: 'crimson',
    name: 'Red Alert',
    tag: 'CYBERPUNK OPS',
    mode: 'dark',
    color: '#ff1e44',
    bg: '#100305',
    cardBg: '#1c060a',
    description: 'High-urgency tactical crimson neon set against deep obsidian shadows.'
  },
  {
    id: 'tactical',
    name: 'Tactical Paper',
    tag: 'DAYLIGHT OPERATIONS',
    mode: 'light',
    color: '#0284c7',
    bg: '#f1f5f9',
    cardBg: '#ffffff',
    description: 'Sunlight-readable high-contrast day terminal compliant with WCAG AAA.'
  },
];

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('nethunt_theme');
    if (saved && THEMES.some(t => t.id === saved)) {
      return saved;
    }
    return 'cyber';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(
      'theme-cyber',
      'theme-matrix',
      'theme-amber',
      'theme-synthwave',
      'theme-crimson',
      'theme-tactical',
      'dark',
      'light'
    );
    root.classList.add(`theme-${theme}`);
    
    if (theme === 'tactical') {
      root.classList.add('light');
    } else {
      root.classList.add('dark');
    }
    
    localStorage.setItem('nethunt_theme', theme);
  }, [theme]);

  const cycleTheme = () => {
    setTheme(prev => {
      const idx = THEMES.findIndex(t => t.id === prev);
      const nextIdx = (idx + 1) % THEMES.length;
      return THEMES[nextIdx].id;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
