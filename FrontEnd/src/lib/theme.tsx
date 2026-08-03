"use client";

import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";

export type ThemeMode = "dark" | "light" | "system";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    return (
        <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
        </NextThemesProvider>
    );
}

export function useTheme() {
    const { theme, setTheme, resolvedTheme } = useNextTheme();
    const currentTheme = (theme || "system") as ThemeMode;
    const currentResolved = (resolvedTheme || "dark") as "dark" | "light";
    return {
        theme: currentTheme,
        resolvedTheme: currentResolved,
        setTheme: (t: ThemeMode) => setTheme(t),
        toggle: () => setTheme(currentResolved === "light" ? "dark" : "light"),
    };
}
