"use client";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import Logo from "@/components/ui/Logo";
import { houseColour, hexToRgb } from "@/lib/houseTheme";
import { API_BASE } from "@/lib/api";

const REFRESH_MS = 30000;
const MEDALS = ["🥇", "🥈", "🥉", "4"];

// Deliberately bypasses the shared `api` singleton (which force-redirects to
// /login on 401): this is a fullscreen kiosk display and should never bounce
// away from itself. If no session token exists yet on this device, it shows
// a quiet waiting state instead.
function kioskClient() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return axios.create({
    baseURL: API_BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export default function LeaderboardPage() {
  const [houses, setHouses] = useState<any[]>([]);
  const [ticker, setTicker] = useState<any[]>([]);
  // Starts null so the server-rendered markup and the first client render
  // match exactly (a `new Date()` initial value differs by the ms it takes
  // to hydrate, which React flags as a hydration mismatch). The real clock
  // only starts ticking client-side, after mount.
  const [clock, setClock] = useState<Date | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      const client = kioskClient();
      const [houseRes, entriesRes] = await Promise.all([
        client.get("/houses/"),
        client.get("/late-entries/", { params: { page_size: 15 } }),
      ]);
      setHouses(houseRes.data);
      setTicker(entriesRes.data.items || []);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    load();
    const dataTimer = setInterval(load, REFRESH_MS);
    setClock(new Date());
    const clockTimer = setInterval(() => setClock(new Date()), 1000);
    return () => { clearInterval(dataTimer); clearInterval(clockTimer); };
  }, [load]);

  const ranked = [...houses].sort((a, b) => a.rank - b.rank);
  const tickerLine = ticker.length
    ? ticker.map((e) => `${e.student_name || "Unidentified"} (${e.house_name}) — ${e.minutes_late}m late`).join("    •    ")
    : "Waiting for late entries…";

  return (
    <div className="min-h-screen bg-bg relative overflow-hidden flex flex-col">
      <div className="ambient-bg">
        <div className="ambient-blob w-[600px] h-[600px] bg-indigo-700 -top-56 left-1/3 animate-float-slow" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-10 py-8">
        <div className="flex items-center gap-4">
          <Logo size="lg" />
          <div>
            <div className="text-2xl font-bold tracking-tight text-white">Attendify.ai</div>
            <div className="text-ink-secondary text-sm">House Leaderboard</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-5xl font-bold tabular-nums tracking-tight text-white">
            {clock ? clock.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}
          </div>
          <div className="text-ink-secondary text-sm mt-1">
            {clock ? clock.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : ""}
          </div>
        </div>
      </div>

      {/* Connection state */}
      {connected === false && (
        <div className="relative z-10 mx-10 mb-4 px-5 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm">
          Not connected — sign in once on this device at <span className="underline">/login</span> to activate the live display.
        </div>
      )}

      {/* House cards */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-10 pb-10">
        <div className="grid grid-cols-4 gap-6 w-full max-w-7xl items-end">
          {ranked.map((house) => {
            const c = houseColour(house);
            const isFirst = house.rank === 1;
            return (
              <motion.div
                key={house.id}
                layout
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={`relative rounded-3xl glass-hi overflow-hidden ${isFirst ? "py-12 px-8" : "py-8 px-6"}`}
                style={{
                  boxShadow: `0 0 0 1px rgba(${hexToRgb(c)},0.35), 0 30px 80px -20px rgba(${hexToRgb(c)},0.5)`,
                }}
              >
                <motion.div
                  className="absolute inset-0 opacity-25"
                  style={{ background: `radial-gradient(ellipse at 50% 0%, ${c}, transparent 70%)` }}
                  animate={{ opacity: [0.15, 0.35, 0.15] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="relative flex flex-col items-center text-center">
                  <div className={isFirst ? "text-6xl mb-3" : "text-4xl mb-2"}>{MEDALS[house.rank - 1]}</div>
                  <div className={`font-bold text-white tracking-tight ${isFirst ? "text-3xl" : "text-xl"}`}>{house.name}</div>
                  <div
                    className={`font-extrabold tabular-nums mt-3 ${isFirst ? "text-7xl" : "text-4xl"}`}
                    style={{ color: c }}
                  >
                    {house.current_points}
                  </div>
                  <div className="text-ink-secondary text-xs mt-1 uppercase tracking-wider">points</div>
                  <div className="text-ink-faint text-xs mt-3">{house.total_late_entries ?? 0} late entries</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom ticker */}
      <div className="relative z-10 border-t border-white/8 glass py-3 overflow-hidden">
        <div className="flex whitespace-nowrap animate-ticker">
          <span className="px-8 text-sm text-ink-secondary">{tickerLine}</span>
          <span className="px-8 text-sm text-ink-secondary" aria-hidden>{tickerLine}</span>
        </div>
      </div>
    </div>
  );
}
