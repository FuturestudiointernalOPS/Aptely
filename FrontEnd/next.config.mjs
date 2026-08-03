import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    allowedDevOrigins: ["127.0.0.1", "localhost"],
    compiler: {
        // Strip all console.* calls from production builds (SWC).
        // Prevents token/institutionId leakage in browser DevTools.
        removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
    },
    transpilePackages: ["remotion", "@remotion/player", "@remotion/core"],

    // ── Locale path rewrites ───────────────────────────────────────────────
    // Must use beforeFiles so rewrites apply BEFORE Next.js filesystem routing.
    // afterFiles (plain array default) runs after Next.js already serves not-found
    // for unknown /[locale]/* paths — too late, rewrite never fires.
    async rewrites() {
        const locales = ["fr", "en", "de", "pt"];
        const rules = locales.map((locale) => ({
            source: `/${locale}/:path*`,
            destination: "/:path*",
        }));
        return { beforeFiles: rules };
    },

    // ── HTTP Security Headers ──────────────────────────────────────────────
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    // Prevent browser from MIME-type sniffing
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    // Block clickjacking attacks
                    { key: "X-Frame-Options", value: "DENY" },
                    // Stop XSS in older browsers
                    { key: "X-XSS-Protection", value: "1; mode=block" },
                    // Only send referer on same origin
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    // Force HTTPS for 1 year (only relevant in production)
                    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
                    // Allow camera+microphone for Jitsi Meet embedded interviews
                    { key: "Permissions-Policy", value: "camera=(self \"https://meet.jit.si\"), microphone=(self \"https://meet.jit.si\"), geolocation=(), interest-cohort=()" },
                    // Content Security Policy — tightly scoped for Next.js
                    {
                        key: "Content-Security-Policy",
                        value: [
                            "default-src 'self'",
                            // unsafe-inline/eval required by Next.js; meet.jit.si for Jitsi embed API
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://meet.jit.si https://cal.com https://*.cal.com",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://meet.jit.si https://cal.com https://*.cal.com",
                            "font-src 'self' https://fonts.gstatic.com https://meet.jit.si",
                            "img-src 'self' data: blob: https://*.supabase.co https://meet.jit.si https://cal.com https://*.cal.com",
                            // connect-src: Jitsi WebRTC + XMPP signaling + Cal.com API
                            `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL} https://*.supabase.co wss://*.jitsi.net wss://meet.jit.si https://meet.jit.si https://cal.com https://*.cal.com`,
                            // frame-src: Jitsi creates iframes internally; Cal.com embed
                            "frame-src 'self' https://meet.jit.si https://cal.com https://*.cal.com",
                            "frame-ancestors 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                            // WebRTC media
                            "media-src 'self' blob: mediastream:",
                        ].join("; "),
                    },
                ],
            },
        ];
    },
};

export default withBundleAnalyzer(nextConfig);
