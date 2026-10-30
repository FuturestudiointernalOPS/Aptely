"use client";

import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";

interface JitsiEmbedProps {
  meetingUrl: string;
  displayName: string;
  onClose: () => void;
}

interface JitsiAPI {
  dispose: () => void;
  addEventListener: (event: string, handler: () => void) => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: {
      new (domain: string, options: Record<string, unknown>): JitsiAPI;
    };
  }
}

// Track if Jitsi script is already loaded to prevent duplicate script injection
let jitsiScriptLoaded = false;

export default function JitsiEmbed({ meetingUrl, displayName, onClose }: JitsiEmbedProps) {
  const locale = getClientLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiAPI | null>(null);
  const disposedRef = useRef(false);

  const roomName = meetingUrl.replace(/^https?:\/\/[^/]+\//, "");
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const initJitsi = useCallback(() => {
    if (!containerRef.current || !window.JitsiMeetExternalAPI || disposedRef.current) return;

    if (apiRef.current) {
      try { apiRef.current.dispose(); } catch { /* ignore */ }
      apiRef.current = null;
    }

    apiRef.current = new window.JitsiMeetExternalAPI("meet.jit.si", {
      roomName,
      parentNode: containerRef.current,
      userInfo: { displayName },
      width: "100%",
      height: 480,
      configOverwrite: {
        startWithAudioMuted: true,
        // Camera off until the user enables it. Auto-start video on this GPU
        // (NVIDIA nouveau) has taken down the whole desktop session.
        startWithVideoMuted: true,
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        resolution: 480,
        constraints: {
          video: {
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 15, max: 24 },
          },
        },
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        // No screen share: capturing the desktop on Wayland has crashed the compositor.
        TOOLBAR_BUTTONS: ["microphone", "camera", "chat", "tileview", "hangup"],
      },
    });
    apiRef.current.addEventListener("videoConferenceLeft", () => onCloseRef.current());
  }, [roomName, displayName]);

  const disposeJitsi = useCallback(() => {
    disposedRef.current = true;
    if (apiRef.current) {
      try { apiRef.current.dispose(); } catch { /* ignore */ }
      apiRef.current = null;
    }
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;

    const start = () => {
      if (!disposedRef.current) initJitsi();
    };

    if (window.JitsiMeetExternalAPI) {
      start();
    } else if (!jitsiScriptLoaded) {
      jitsiScriptLoaded = true;
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = start;
      document.head.appendChild(script);
    } else {
      interval = setInterval(() => {
        attempts += 1;
        if (window.JitsiMeetExternalAPI) {
          if (interval) clearInterval(interval);
          start();
        } else if (attempts >= 20) {
          if (interval) clearInterval(interval);
        }
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
      disposeJitsi();
    };
  }, [initJitsi, disposeJitsi]);

  const handleClose = () => {
    disposeJitsi();
    onClose();
  };

  return (
    <div className="bg-[var(--bg-deep)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {t(locale, "interview.jitsi.inProgress", "Entretien en cours")}
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
