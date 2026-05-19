'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@/components/icons/Icon';

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('yotop10_theme');
    if (stored === 'light') {
      setDark(false);
      document.documentElement.classList.add('light-mode');
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('yotop10_theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('light-mode', !next);
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 cursor-pointer text-[15px] leading-none flex items-center min-h-[44px] hover:bg-white/10 transition"
    >
      <Icon name={dark ? 'Sun' : 'Moon'} size={18} color={dark ? '#fbbf24' : '#6366f1'} />
    </button>
  );
}
