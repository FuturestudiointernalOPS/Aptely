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

  const initJitsi = useCallback(() => {
    if (!containerRef.current || !window.JitsiMeetExternalAPI || disposedRef.current) return;
    
    // Dispose previous instance if any
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
        startWithVideoMuted: false,
        prejoinPageEnabled: false,
        disableDeepLinking: true,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        TOOLBAR_BUTTONS: ["microphone", "camera", "desktop", "chat", "tileview", "hangup"],
      },
    });
    apiRef.current.addEventListener("videoConferenceLeft", onClose);
  }, [roomName, displayName, onClose]);

  const disposeJitsi = useCallback(() => {
    disposedRef.current = true;
    if (apiRef.current) {
      try { apiRef.current.dispose(); } catch { /* ignore */ }
      apiRef.current = null;
    }
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    
    if (window.JitsiMeetExternalAPI) {
      initJitsi();
      return;
    }
    
    if (jitsiScriptLoaded) {
      // Script is loading but API not ready yet, poll
      const interval = setInterval(() => {
        if (window.JitsiMeetExternalAPI) {
          clearInterval(interval);
          initJitsi();
        }
      }, 500);
      return () => {
        clearInterval(interval);
        disposeJitsi();
      };
    }
    
    jitsiScriptLoaded = true;
    const script = document.createElement("script");
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onload = initJitsi;
    document.head.appendChild(script);

    return () => {
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
