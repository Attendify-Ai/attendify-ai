"use client";
import { motion, type HTMLMotionProps } from "framer-motion";
import { hexToRgb } from "@/lib/houseTheme";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  glowColour?: string; // hex — enables a coloured hover-lift glow
  hover?: boolean;
}

export default function GlassCard({
  children,
  className = "",
  glowColour,
  hover = true,
  style,
  ...rest
}: GlassCardProps) {
  const glowStyle = glowColour
    ? ({ "--glow": hexToRgb(glowColour) } as React.CSSProperties)
    : undefined;

  return (
    <motion.div
      whileHover={
        hover
          ? {
              y: -4,
              transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
            }
          : undefined
      }
      className={`glass rounded-2xl shadow-glass transition-shadow duration-300 ${
        hover ? "hover:border-white/20" : ""
      } ${className}`}
      style={{ ...glowStyle, ...style }}
      onMouseEnter={(e) => {
        if (glowColour) {
          (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px -12px rgba(var(--glow), 0.45), 0 0 0 1px rgba(var(--glow), 0.25)`;
        }
      }}
      onMouseLeave={(e) => {
        if (glowColour) {
          (e.currentTarget as HTMLElement).style.boxShadow = "";
        }
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
