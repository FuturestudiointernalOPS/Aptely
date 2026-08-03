import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class",
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    navy: '#0F1128',
                    deep: '#222652',
                    orange: '#FF6B00',
                    light: '#F8FAFC',
                    accent: '#3B82F6',
                },
                aptely: {
                    orange: "#FF6B00",
                    "orange-soft": "#FF8A33",
                    "orange-100": "#FFF0E6",
                    "orange-200": "#FFDCC2",
                    "orange-600": "#E05E00",
                    "orange-700": "#C25200",
                    navy: "#1A1D2E",
                    "navy-600": "#252840",
                    "navy-700": "#14172A",
                    "navy-800": "#0F1020",
                },
                // Obsidian Glass surfaces
                deep: "var(--bg-deep)",
                canvas: "var(--bg-canvas)",
                elevated: "var(--bg-elevated)",
                "glass-bg": "var(--glass-bg)",
                "glass-hover": "var(--glass-bg-hover)",
                "glass-active": "var(--glass-bg-active)",
                "glass-border": "var(--glass-border)",
                "glass-border-hover": "var(--glass-border-hover)",
                active: "var(--glass-border-active)",
                // Text
                "t-primary": "var(--text-primary)",
                "t-secondary": "var(--text-secondary)",
                "t-muted": "var(--text-muted)",
            },
            fontFamily: {
                display: ["'Outfit'", "'Space Grotesk'", "system-ui", "-apple-system", "sans-serif"],
                sans: ["'DM Sans'", "system-ui", "-apple-system", "sans-serif"],
                jakarta: ["'DM Sans'", "system-ui", "sans-serif"],
            },
            borderRadius: {
                "2xl": "16px",
                "3xl": "20px",
                "4xl": "24px",
            },
            boxShadow: {
                "3xl": "0 35px 60px -15px rgba(0, 0, 0, 0.5)",
                card: "0 2px 16px rgba(0,0,0,0.3)",
                "card-hover": "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
                orange: "0 4px 20px rgba(255,107,0,0.25)",
                "orange-lg": "0 6px 30px rgba(255,107,0,0.35)",
                "glow-sm": "0 0 20px rgba(255,107,0,0.08)",
                "glow-md": "0 0 30px rgba(255,107,0,0.15)",
                "glow-lg": "0 0 60px rgba(255,107,0,0.2)",
                glass: "0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
            },
            backdropBlur: {
                xs: "4px",
                "2xl": "24px",
                "3xl": "40px",
            },
            animation: {
                "fade-in-up": "fadeInUp 0.5s ease both",
                "spin-slow": "spin 2s linear infinite",
                shimmer: "shimmer 2s infinite linear",
                "glow-pulse": "glowPulse 3s ease-in-out infinite",
                "pulse-slow": "pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                float: "float 6s ease-in-out infinite",
            },
            keyframes: {
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-20px)" },
                },
                fadeInUp: {
                    from: { opacity: "0", transform: "translateY(20px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                shimmer: {
                    "0%": { backgroundPosition: "-200% 0" },
                    "100%": { backgroundPosition: "200% 0" },
                },
                glowPulse: {
                    "0%, 100%": { opacity: "0.4" },
                    "50%": { opacity: "0.8" },
                },
            },
        },
    },
    plugins: [],
};

export default config;
