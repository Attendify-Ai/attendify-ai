"use client";
import { useEffect, useState } from "react";

export const THEME_KEY = "attendify-theme";

export function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className="w-9 h-9 rounded-lg flex items-center justify-center text-base hover:bg-white/5 border border-white/10 transition-colors"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
