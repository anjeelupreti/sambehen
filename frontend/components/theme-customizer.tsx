'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Palette, Sun, Monitor } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const COLORS = [
  { name: 'Default', value: 'default', colorClass: 'bg-indigo-600' },
  { name: 'Rose', value: 'rose', colorClass: 'bg-rose-600' },
  { name: 'Emerald', value: 'emerald', colorClass: 'bg-emerald-600' },
  { name: 'Violet', value: 'violet', colorClass: 'bg-violet-600' },
  { name: 'Orange', value: 'orange', colorClass: 'bg-orange-600' },
];

export function ThemeCustomizer() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [colorPreset, setColorPreset] = useState('default');

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('sambehen-color-preset') || 'default';
    setColorPreset(saved);
    if (saved !== 'default') {
      document.documentElement.setAttribute('data-theme-color', saved);
    }
  }, []);

  const changeColor = (color: string) => {
    setColorPreset(color);
    localStorage.setItem('sambehen-color-preset', color);
    if (color === 'default') {
      document.documentElement.removeAttribute('data-theme-color');
    } else {
      document.documentElement.setAttribute('data-theme-color', color);
    }
  };

  if (!mounted) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0" title="Customize Theme">
          <Palette className="h-[1.2rem] w-[1.2rem] transition-all" />
          <span className="sr-only">Customize Theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="p-2 space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-2">
            Mode
          </span>
          <div className="grid grid-cols-3 gap-1">
            <Button
              variant={theme === 'light' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex flex-col gap-1 h-auto py-2"
              onClick={() => setTheme('light')}
            >
              <Sun className="h-4 w-4" />
              <span className="text-[10px]">Light</span>
            </Button>
            <Button
              variant={theme === 'dark' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex flex-col gap-1 h-auto py-2"
              onClick={() => setTheme('dark')}
            >
              <Moon className="h-4 w-4" />
              <span className="text-[10px]">Dark</span>
            </Button>
            <Button
              variant={theme === 'system' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex flex-col gap-1 h-auto py-2"
              onClick={() => setTheme('system')}
            >
              <Monitor className="h-4 w-4" />
              <span className="text-[10px]">System</span>
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator />

        <div className="p-2 space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-2">
            Accent Color
          </span>
          <div className="grid grid-cols-5 gap-1">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => changeColor(c.value)}
                title={c.name}
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${c.colorClass} ${
                  colorPreset === c.value
                    ? 'border-foreground scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
              />
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
