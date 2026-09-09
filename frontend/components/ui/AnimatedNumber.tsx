"use client";
import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export default function AnimatedNumber({
  value,
  className = "",
  format = (n: number) => Math.round(n).toLocaleString(),
}: {
  value: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20, mass: 0.6 });
  const display = useTransform(spring, (v) => format(v));
  const mounted = useRef(false);

  useEffect(() => {
    motionValue.set(mounted.current ? value : 0);
    if (!mounted.current) {
      // Animate up from 0 on first mount for the "count up on load" feel.
      requestAnimationFrame(() => motionValue.set(value));
      mounted.current = true;
    }
  }, [value, motionValue]);

  return <motion.span className={className}>{display}</motion.span>;
}
