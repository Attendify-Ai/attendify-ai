"use client";
import { motion, type HTMLMotionProps } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-white text-black hover:bg-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_24px_-8px_rgba(255,255,255,0.3)]",
  secondary: "glass text-white hover:bg-white/10",
  ghost: "text-ink-secondary hover:text-white hover:bg-white/5",
  danger: "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25",
  success: "bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25",
};

export default function Button({
  children,
  variant = "primary",
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
