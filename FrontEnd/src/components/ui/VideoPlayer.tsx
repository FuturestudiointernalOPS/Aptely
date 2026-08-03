"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { OfferVideoProps } from "@/remotion/types";
import { OfferComposition } from "@/remotion/OfferComposition";
import { getClientLocale, t } from "@/lib/i18n";

const Player = dynamic(
  () => import("@remotion/player").then((m) => ({ default: m.Player })),
  { ssr: false, loading: () => <div className="aspect-video rounded-2xl bg-[var(--bg-raised)] animate-pulse" /> }
);

interface VideoPlayerProps {
  inputProps: OfferVideoProps;
  autoPlay?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OfferComp = OfferComposition as React.ComponentType<any>;

export function VideoPlayer({ inputProps, autoPlay = false }: VideoPlayerProps) {
  const locale = getClientLocale();
  const localizedProps: OfferVideoProps = {
    ...inputProps,
    labels: {
      kicker: t(locale, "offers.video.kicker", "Job offer"),
      compensation: t(locale, "offers.video.compensation", "Compensation"),
      startDate: t(locale, "offers.video.startDate", "Start date"),
      ctaPrefix: t(locale, "offers.video.ctaPrefix", "For"),
      ctaSuffix: t(locale, "offers.video.ctaSuffix", "— an offer awaits you"),
    },
  };
  return (
    <div className="aspect-video rounded-2xl overflow-hidden border border-[var(--border)]">
      <Player
        component={OfferComp}
        inputProps={localizedProps}
        durationInFrames={300}
        compositionWidth={1280}
        compositionHeight={720}
        fps={60}
        style={{ width: "100%", height: "100%" }}
        controls
        autoPlay={autoPlay}
      />
    </div>
  );
}
