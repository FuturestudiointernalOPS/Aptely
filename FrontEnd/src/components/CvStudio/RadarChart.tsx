"use client";

import { useMemo } from "react";

interface RadarChartProps {
  modules: Array<{
    key: string;
    label: string;
    score: number | null;
  }>;
  size?: number;
}

export default function RadarChart({ modules, size = 280 }: RadarChartProps) {
  if (modules.length === 0) return null;
  const center = size / 2;
  const radius = size / 2 - 30;
  const angleStep = (2 * Math.PI) / modules.length;

  const points = useMemo(() => {
    return modules.map((m, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = ((m.score ?? 0) / 100) * radius;
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
        labelX: center + (radius + 18) * Math.cos(angle),
        labelY: center + (radius + 18) * Math.sin(angle),
        axisX: center + radius * Math.cos(angle),
        axisY: center + radius * Math.sin(angle),
        ...m,
      };
    });
  }, [modules, angleStep, radius, center]);

  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="mx-auto"
      role="img"
      aria-label={`CV analysis radar chart: ${modules.map((m) => `${m.label} ${m.score ?? 0}`).join(", ")}`}
    >
      <title>CV Analysis Radar</title>
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={modules
            .map((_, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const r = level * radius;
              return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
            })
            .join(" ")}
          fill="none"
          stroke="var(--border)"
          strokeWidth={0.5}
          opacity={0.5}
        />
      ))}

      {points.map((p, i) => (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={p.axisX}
          y2={p.axisY}
          stroke="var(--border)"
          strokeWidth={0.5}
          opacity={0.3}
        />
      ))}

      <polygon
        points={polygon}
        fill="var(--accent)"
        fillOpacity={0.15}
        stroke="var(--accent)"
        strokeWidth={2}
      />

      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill="var(--accent)"
        />
      ))}

      {points.map((p, i) => (
        <text
          key={i}
          x={p.labelX}
          y={p.labelY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fill="var(--text-secondary)"
          fontFamily="inherit"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}
