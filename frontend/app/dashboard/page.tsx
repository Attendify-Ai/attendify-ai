"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/layout/AppShell";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import Skeleton from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { getHouses, getSummary, getLateEntries, getStudents, getHouseHistory, adjustPoints } from "@/lib/api";
import { getStoredUser, isAdmin, dashboardHome } from "@/lib/auth";
import { houseColour, hexToRgb } from "@/lib/houseTheme";

const REFRESH_MS = 30000;
const RANK_SUFFIX = ["st", "nd", "rd"];
const QUICK_AMOUNTS = [5, 10, 25, 50];

function ordinal(n: number) {
  const suffix = n <= 3 ? RANK_SUFFIX[n - 1] : "th";
  return `${n}${suffix}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function DashboardPage() {
  const router = useRouter();
  const user = getStoredUser();
  const admin = isAdmin();

  useEffect(() => {
    if (user && user.role !== "admin") router.replace(dashboardHome(user.role));
  }, [user, router]);

  const [houses, setHouses] = useState<any[]>([]);
  const [prevRanks, setPrevRanks] = useState<Record<number, number>>({});
  const [summary, setSummary] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [pointsToday, setPointsToday] = useState(0);
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedHouse, setSelectedHouse] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustSign, setAdjustSign] = useState<1 | -1>(1);
  const [adjustForm, setAdjustForm] = useState({ points: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const houseRef = useRef<Record<number, number>>({});

  const load = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const [houseData, summaryData, recentData, todayData, studentsData] = await Promise.all([
      getHouses(),
      getSummary(),
      getLateEntries({ page_size: "8" } as any),
      getLateEntries({ date_from: today, date_to: today, page_size: "200" } as any),
      getStudents(),
    ]);

    setPrevRanks(houseRef.current);
    const newRanks: Record<number, number> = {};
    houseData.forEach((h: any) => { newRanks[h.id] = h.rank; });
    houseRef.current = newRanks;

    setHouses(houseData);
    setSummary(summaryData);
    setRecent(recentData.items || []);
    setPointsToday((todayData.items || []).reduce((sum: number, e: any) => sum + (e.points_deducted || 0), 0));
    setEnrolledCount(studentsData.filter((s: any) => s.enrollment_status === "enrolled").length);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(console.error);
    const t = setInterval(() => load().catch(console.error), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const openHistory = async (house: any) => {
    setSelectedHouse(house);
    const data = await getHouseHistory(house.id);
    setHistory(data.history || []);
  };

  const openAdjust = (house: any, sign: 1 | -1, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedHouse(house);
    setAdjustSign(sign);
    setAdjustForm({ points: "", reason: "" });
    setShowAdjust(true);
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHouse) return;
    const pts = Math.abs(Number(adjustForm.points)) * adjustSign;
    if (pts === 0) return;
    setSaving(true);
    try {
      await adjustPoints(selectedHouse.id, pts, adjustForm.reason);
      setShowAdjust(false);
      await load();
    } catch {
      alert("Failed to adjust points");
    } finally {
      setSaving(false);
    }
  };

  const stats = [
    { label: "Late today", value: summary?.today_late_count ?? 0, colour: "#f59e0b" },
    { label: "Points deducted today", value: pointsToday, colour: "#ef4444" },
    { label: "Students enrolled", value: enrolledCount ?? 0, colour: "#22c55e" },
    { label: "Review queue", value: summary?.review_queue_count ?? 0, colour: "#3b82f6" },
  ];

  return (
    <AppShell>
      {/* Hero */}
      <div className="mb-10">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold tracking-tight text-white"
        >
          {greeting()}, {user?.name?.split(" ")[0] || "there"}
        </motion.h1>
        <p className="text-ink-secondary text-sm mt-1.5">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* House cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {loading && houses.length === 0
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44" />)
          : houses.map((house) => {
              const c = houseColour(house);
              const prevRank = prevRanks[house.id];
              const rankChange = prevRank && prevRank !== house.rank ? prevRank - house.rank : 0;
              return (
                <GlassCard
                  key={house.id}
                  glowColour={c}
                  onClick={() => openHistory(house)}
                  className="p-5 cursor-pointer relative overflow-hidden"
                >
                  <div
                    className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20"
                    style={{ background: c }}
                  />
                  <div className="relative flex items-start justify-between mb-3">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full border"
                      style={{ color: c, borderColor: `rgba(${hexToRgb(c)},0.35)`, background: `rgba(${hexToRgb(c)},0.1)` }}
                    >
                      {ordinal(house.rank)}
                    </span>
                    <AnimatePresence mode="wait">
                      {rankChange !== 0 && (
                        <motion.span
                          key={rankChange}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className={`text-xs font-bold flex items-center gap-0.5 ${rankChange > 0 ? "text-green-400" : "text-red-400"}`}
                        >
                          {rankChange > 0 ? "↑" : "↓"} {Math.abs(rankChange)}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="relative font-bold text-lg text-white mb-1">{house.name}</div>
                  <AnimatedNumber
                    value={house.current_points}
                    className="relative block text-4xl font-extrabold tracking-tight text-white"
                  />
                  <div className="relative text-xs text-ink-secondary mt-1">points</div>
                  <div className="relative mt-4 pt-3 border-t border-white/8 text-xs text-ink-secondary">
                    {house.total_late_entries ?? 0} late entries
                  </div>
                </GlassCard>
              );
            })}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {stats.map((s) => (
          <GlassCard key={s.label} hover={false} className="p-5">
            {loading ? (
              <Skeleton className="h-9 w-16 mb-2" />
            ) : (
              <AnimatedNumber value={s.value} className="block text-3xl font-bold" />
            )}
            <div className="text-xs text-ink-secondary mt-1.5">{s.label}</div>
          </GlassCard>
        ))}
      </div>

      {/* Recent activity */}
      <GlassCard hover={false} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            live
          </span>
        </div>
        <div className="divide-y divide-white/5">
          {!loading && recent.length === 0 && (
            <div className="px-6 py-10 text-center text-ink-faint text-sm">No late entries yet today</div>
          )}
          {loading && recent.length === 0 &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-4"><Skeleton className="h-5 w-full" /></div>
            ))}
          <AnimatePresence initial={false}>
            {recent.map((e: any) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-6 py-3.5 flex items-center justify-between text-sm hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: houseColour({ name: e.house_name }) }}
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">{e.student_name || "Unidentified"}</div>
                    <div className="text-xs text-ink-secondary">
                      {e.house_name} · {e.arrival_time?.slice(0, 5)} · {e.minutes_late} min late
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-red-400 font-semibold text-xs">-{e.points_deducted}</span>
                  <Badge label={e.status} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </GlassCard>

      {/* Point history panel */}
      {selectedHouse && (
        <GlassCard hover={false} className="mt-8">
          <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">{selectedHouse.name} — Point History</h2>
              <p className="text-xs text-ink-secondary mt-0.5">All point changes including late entry deductions</p>
            </div>
            <div className="flex items-center gap-2">
              {admin && (
                <>
                  <Button variant="success" className="text-xs px-3 py-1.5" onClick={(e) => openAdjust(selectedHouse, 1, e)}>
                    + Add
                  </Button>
                  <Button variant="danger" className="text-xs px-3 py-1.5" onClick={(e) => openAdjust(selectedHouse, -1, e)}>
                    − Deduct
                  </Button>
                </>
              )}
              <button onClick={() => setSelectedHouse(null)} className="text-ink-secondary hover:text-white text-lg leading-none w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/5">✕</button>
            </div>
          </div>
          <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
            {history.length === 0 && <div className="px-6 py-8 text-center text-ink-faint text-sm">No history yet</div>}
            {history.map((h: any, i: number) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between text-sm">
                <div className="flex-1 min-w-0 pr-4">
                  <span className="font-medium text-white">{h.reason}</span>
                  {h.by && <span className="text-ink-faint ml-2 text-xs">by {h.by}</span>}
                  <div className="text-xs text-ink-faint mt-0.5">{h.at ? new Date(h.at).toLocaleString() : ""}</div>
                </div>
                <div className={`font-bold text-base shrink-0 ${h.points > 0 ? "text-green-400" : "text-red-400"}`}>
                  {h.points > 0 ? "+" : ""}{h.points}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Adjust points modal */}
      <Modal open={showAdjust} onClose={() => setShowAdjust(false)} title={`${adjustSign === 1 ? "Add Points" : "Deduct Points"} — ${selectedHouse?.name}`}>
        <form onSubmit={handleAdjust} className="space-y-4">
          <div className="flex rounded-xl border border-white/10 overflow-hidden">
            <button type="button" onClick={() => setAdjustSign(1)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${adjustSign === 1 ? "bg-green-500/20 text-green-400" : "text-ink-secondary hover:bg-white/5"}`}>
              + Add Points
            </button>
            <button type="button" onClick={() => setAdjustSign(-1)}
              className={`flex-1 py-2.5 text-sm font-semibold border-l border-white/10 transition-colors ${adjustSign === -1 ? "bg-red-500/20 text-red-400" : "text-ink-secondary hover:bg-white/5"}`}>
              − Deduct Points
            </button>
          </div>

          <div>
            <label className="block text-xs text-ink-secondary mb-2">Quick amounts</label>
            <div className="flex gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button key={amt} type="button" onClick={() => setAdjustForm((f) => ({ ...f, points: String(amt) }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    adjustForm.points === String(amt)
                      ? adjustSign === 1 ? "bg-green-500/20 border-green-500/40 text-green-400" : "bg-red-500/20 border-red-500/40 text-red-400"
                      : "border-white/10 text-ink-secondary hover:bg-white/5"
                  }`}>
                  {amt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-white">Points <span className="text-ink-faint font-normal">(or enter custom)</span></label>
            <input type="number" min="1" value={adjustForm.points} onChange={(e) => setAdjustForm((f) => ({ ...f, points: e.target.value }))} required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 focus:border-white/40 outline-none text-sm text-white" placeholder="e.g. 20" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-white">Statement / Reason <span className="text-red-400">*</span></label>
            <textarea value={adjustForm.reason} onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))} required rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 focus:border-white/40 outline-none text-sm text-white resize-none"
              placeholder="e.g. Won inter-house cricket tournament" />
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="ghost" onClick={() => setShowAdjust(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !adjustForm.points || !adjustForm.reason} variant={adjustSign === 1 ? "success" : "danger"}>
              {saving ? "Saving…" : adjustSign === 1 ? `Add ${adjustForm.points || "?"} pts` : `Deduct ${adjustForm.points || "?"} pts`}
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
