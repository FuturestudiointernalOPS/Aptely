"use client";

import React, { useRef } from "react";
import { motion, useMotionValue, useTransform, useSpring, useInView } from "motion/react";
import Link from "next/link";

export function FadeIn({
  children,
  delay = 0,
  className,
  direction = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "left" | "right" | "none";
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const variants = {
    hidden: {
      opacity: 0,
      y: direction === "up" ? 40 : 0,
      x: direction === "left" ? -40 : direction === "right" ? 40 : 0,
    },
    visible: { opacity: 1, y: 0, x: 0 },
  };
  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { damping: 20, stiffness: 200 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { damping: 20, stiffness: 200 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current!.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function PulsingCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="relative inline-block group">
      <span className="absolute inset-0 rounded-[2rem] bg-[var(--accent)] animate-ping opacity-20 group-hover:opacity-0 transition-opacity" />
      <span className="relative bg-[var(--accent)] text-white px-16 py-8 rounded-[2rem] font-black text-2xl inline-block transition-all group-hover:scale-105 shadow-2xl shadow-[var(--accent)]/30">
        {children}
      </span>
    </Link>
  );
}
