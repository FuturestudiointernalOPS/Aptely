"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon, Languages } from "lucide-react";
import { getClientLocale } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

interface LocaleThemeBarProps {
  hideLanguage?: boolean;
  hideTheme?: boolean;
}

export default function LocaleThemeBar({ hideLanguage, hideTheme }: LocaleThemeBarProps) {
  const router = useRouter();
  const locale = getClientLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const switchLocale = () => {
    const next = locale === "fr" ? "en" : "fr";
    const pathname = window.location.pathname;
    const newPath = pathname.startsWith(`/${locale}/`)
      ? `/${next}${pathname.slice(3)}`
      : `/${next}${pathname}`;
    router.push(newPath);
  };

  const toggleTheme = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(next);
    root.style.colorScheme = next;
  };

  if (!mounted) return null;

  return (
    <div className="fixed top-4 right-4 z-[110] flex items-center gap-2">
      {!hideLanguage && (
        <button
          onClick={switchLocale}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-raised)] transition-colors shadow-sm"
          title={locale === "fr" ? "Switch to English" : "Passer en français"}
        >
          <Languages className="w-3.5 h-3.5" />
          <span>{locale === "fr" ? "EN" : "FR"}</span>
        </button>
      )}
      {!hideTheme && (
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-raised)] transition-colors shadow-sm"
          title={resolvedTheme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}
