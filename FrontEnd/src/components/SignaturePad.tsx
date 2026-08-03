"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Trash2, PenLine } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";

interface SignaturePadProps {
  onSigned: (dataUrl: string) => void;
  onClear?: () => void;
  label?: string;
  disabled?: boolean;
}

export default function SignaturePad({ onSigned, onClear, label, disabled }: SignaturePadProps) {
  const locale = getClientLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [drawing, setDrawing] = useState(false);
  const hasSigRef = useRef(false);
  const [hasSig, setHasSig] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    setupCanvas();
    window.addEventListener("resize", setupCanvas);
    return () => window.removeEventListener("resize", setupCanvas);
  }, [setupCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    drawingRef.current = true;
    setDrawing(true);
    const pos = getPos(e);
    lastPos.current = pos;
    const ctx = getCtx();
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx || !lastPos.current) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    hasSigRef.current = true;
    setHasSig(true);
  };

  const endDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    drawingRef.current = false;
    setDrawing(false);
    lastPos.current = null;
    if (hasSigRef.current && canvasRef.current) {
      onSigned(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSigRef.current = false;
    setHasSig(false);
    onClear?.();
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-1.5">
          <PenLine className="w-3.5 h-3.5 text-[var(--accent)]" />
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
        </div>
      )}
      <div className={`relative rounded-xl border-2 transition-colors ${
        disabled
          ? "border-[var(--border)] opacity-50"
          : hasSig
          ? "border-[var(--accent)]/40"
          : "border-dashed border-[var(--border)] hover:border-[var(--accent)]/30"
      } bg-white`}>
        <canvas
          ref={canvasRef}
          className="w-full h-28 rounded-xl cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasSig && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-gray-400 select-none">{t(locale, "signature.placeholder", "Sign here")}</p>
          </div>
        )}
        {hasSig && !disabled && (
          <button
            type="button"
            onClick={clear}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 border border-[var(--border)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-400/30 transition-colors"
            title={t(locale, "signature.clear", "Clear")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {hasSig && (
        <p className="text-[10px] text-emerald-400 flex items-center gap-1">
          ✓ {t(locale, "signature.captured", "Signature captured")}
        </p>
      )}
    </div>
  );
}
