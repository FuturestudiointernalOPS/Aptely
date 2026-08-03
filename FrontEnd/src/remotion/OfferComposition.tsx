import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { OfferVideoProps } from "./types";

const DARK_BG = "oklch(14% 0.025 255)";
const SURFACE = "oklch(18% 0.025 255)";
const ORANGE = "oklch(65% 0.22 42)";
const TEXT_PRIMARY = "oklch(94% 0.008 85)";
const TEXT_MUTED = "oklch(50% 0.01 255)";
const BORDER = "oklch(28% 0.02 255)";

const FR_DEFAULTS = {
  kicker: "Offre d'emploi",
  compensation: "Rémunération",
  startDate: "Date de début",
  ctaPrefix: "Pour",
  ctaSuffix: "— une offre vous attend",
};

export const OfferComposition: React.FC<OfferVideoProps> = ({
  candidateName,
  jobTitle,
  company,
  salary,
  startDate,
  labels,
}) => {
  const L = labels ?? FR_DEFAULTS;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: Branding (f0–80)
  const logoOpacity = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp" });
  const logoSpring = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  const logoScale = interpolate(logoSpring, [0, 1], [1.15, 1.0], { extrapolateRight: "clamp" });
  const barWidth = interpolate(frame, [0, 50], [0, 100], { extrapolateRight: "clamp" });

  // Phase 2: Offer card (f60–200)
  const companyOpacity = interpolate(frame, [60, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const companyY = interpolate(frame, [60, 100], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const titleOpacity = interpolate(frame, [80, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [80, 130], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const dividerWidth = interpolate(frame, [110, 155], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const salaryOpacity = interpolate(frame, [130, 165], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const salarySpring = spring({ frame: Math.max(0, frame - 130), fps, config: { stiffness: 200, damping: 18 } });
  const salaryScale = interpolate(salarySpring, [0, 1], [0.8, 1.0]);

  const dateOpacity = interpolate(frame, [158, 188], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dateY = interpolate(frame, [158, 188], [15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Phase 3: CTA (f200–300)
  const ctaOpacity = interpolate(frame, [200, 240], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaY = interpolate(frame, [200, 240], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaPulse = interpolate(frame, [240, 280], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: DARK_BG,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Orange top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 4,
          width: `${barWidth}%`,
          backgroundColor: ORANGE,
        }}
      />

      {/* Phase 1: Branding */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 80,
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          transformOrigin: "left center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: ORANGE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "white", fontSize: 22, fontWeight: 800 }}>A</span>
          </div>
          <span style={{ color: TEXT_PRIMARY, fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>
            Aptely
          </span>
        </div>
        <div style={{ color: TEXT_MUTED, fontSize: 13, marginTop: 6, letterSpacing: 2, textTransform: "uppercase" as const }}>
          {L.kicker}
        </div>
      </div>

      {/* Phase 2: Main offer card */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 900,
          backgroundColor: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: "52px 64px",
        }}
      >
        <div
          style={{
            opacity: companyOpacity,
            transform: `translateY(${companyY}px)`,
            color: ORANGE,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase" as const,
            marginBottom: 16,
          }}
        >
          {company}
        </div>

        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            color: TEXT_PRIMARY,
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -1.5,
            marginBottom: 36,
          }}
        >
          {jobTitle}
        </div>

        <div
          style={{
            height: 1,
            width: `${dividerWidth}%`,
            backgroundColor: BORDER,
            marginBottom: 36,
          }}
        />

        <div style={{ display: "flex", gap: 64, alignItems: "flex-start" }}>
          {salary && (
            <div
              style={{
                opacity: salaryOpacity,
                transform: `scale(${salaryScale})`,
                transformOrigin: "left center",
              }}
            >
              <div style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 8 }}>
                {L.compensation}
              </div>
              <div style={{ color: ORANGE, fontSize: 34, fontWeight: 800 }}>
                {salary}
              </div>
            </div>
          )}

          {startDate && (
            <div
              style={{
                opacity: dateOpacity,
                transform: `translateY(${dateY}px)`,
              }}
            >
              <div style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 8 }}>
                {L.startDate}
              </div>
              <div style={{ color: TEXT_PRIMARY, fontSize: 34, fontWeight: 800 }}>
                {startDate}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phase 3: CTA */}
      <div
        style={{
          position: "absolute",
          bottom: 70,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: ctaOpacity,
          transform: `translateY(${ctaY}px)`,
        }}
      >
        <div
          style={{
            backgroundColor: `oklch(65% 0.22 42 / ${ctaPulse * 15}%)`,
            borderRadius: 100,
            padding: "14px 36px",
            border: `1px solid oklch(65% 0.22 42 / ${ctaPulse * 30}%)`,
          }}
        >
          <span style={{ color: TEXT_MUTED, fontSize: 18 }}>{L.ctaPrefix} </span>
          <span style={{ color: TEXT_PRIMARY, fontWeight: 800, fontSize: 18 }}>{candidateName}</span>
          <span style={{ color: TEXT_MUTED, fontSize: 18 }}> {L.ctaSuffix}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
