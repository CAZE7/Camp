"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark';
const THEME_KEY = 'camp-theme';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  // Start with 'light' on both server and the first client render so hydration
  // matches (the server cannot read localStorage). We sync the real theme from
  // localStorage / system preference right after mount. The pre-hydration script
  // in app/layout.tsx already painted the correct theme class, so there is no
  // visible flash.
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(getInitialTheme());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return { theme, toggleTheme, setTheme };
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
      title={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
      className={cn('h-8 w-8 rounded-md')}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  );
}
