"use client";
import { useId, useState } from "react";

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function FloatingInput({ label, className = "", value, onFocus, onBlur, ...rest }: FloatingInputProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const filled = typeof value === "string" && value.length > 0;
  const floated = focused || filled;

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        className={`peer w-full rounded-xl bg-white/[0.03] border px-4 pt-5 pb-2 text-sm text-white outline-none transition-colors duration-200 placeholder-transparent
          ${focused ? "border-white/40" : "border-white/10 hover:border-white/20"} ${className}`}
        placeholder={label}
        {...rest}
      />
      <label
        htmlFor={id}
        className={`pointer-events-none absolute left-4 transition-all duration-200 ease-apple ${
          floated ? "top-2 text-[11px] text-ink-secondary" : "top-1/2 -translate-y-1/2 text-sm text-ink-secondary"
        }`}
      >
        {label}
      </label>
    </div>
  );
}

export function Select({
  label,
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-ink-secondary mb-1.5">{label}</label>}
      <select
        className={`w-full rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 focus:border-white/40 px-3.5 py-2.5 text-sm text-white outline-none transition-colors duration-200 ${className}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}

export function TextField({
  label,
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-ink-secondary mb-1.5">{label}</label>}
      <input
        className={`w-full rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 focus:border-white/40 px-3.5 py-2.5 text-sm text-white outline-none transition-colors duration-200 placeholder:text-ink-faint ${className}`}
        {...rest}
      />
    </div>
  );
}

export function TextArea({
  label,
  className = "",
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-ink-secondary mb-1.5">{label}</label>}
      <textarea
        className={`w-full rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 focus:border-white/40 px-3.5 py-2.5 text-sm text-white outline-none transition-colors duration-200 resize-none placeholder:text-ink-faint ${className}`}
        {...rest}
      />
    </div>
  );
}
