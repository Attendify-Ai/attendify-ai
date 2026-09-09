"use client";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function SlideOver({ open, onClose, title, subtitle, children }: SlideOverProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md h-full glass-hi border-l border-white/10 shadow-glass flex flex-col"
          >
            <div className="flex items-start justify-between px-6 py-5 border-b border-white/10 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-white">{title}</h2>
                {subtitle && <p className="text-xs text-ink-secondary mt-0.5">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="text-ink-secondary hover:text-white transition-colors text-lg leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
