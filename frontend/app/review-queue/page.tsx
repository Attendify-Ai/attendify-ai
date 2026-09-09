"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/layout/AppShell";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import CircularProgress from "@/components/ui/CircularProgress";
import Skeleton from "@/components/ui/Skeleton";
import { getReviewQueue, updateLateEntry, getStudents } from "@/lib/api";
import { houseColour } from "@/lib/houseTheme";

export default function ReviewQueuePage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reassignId, setReassignId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const load = () => getReviewQueue().then((d) => { setQueue(d); setLoading(false); });

  useEffect(() => {
    load();
    getStudents().then(setStudents);
  }, []);

  const act = async (id: number, payload: object) => {
    setBusyId(id);
    try {
      await updateLateEntry(id, payload);
      setQueue((q) => q.filter((e) => e.id !== id));
      setReassignId(null);
    } catch {
      alert("Failed to update entry");
    } finally {
      setBusyId(null);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students.slice(0, 8);
    const q = search.toLowerCase();
    return students.filter((s: any) => s.name.toLowerCase().includes(q) || s.student_code.toLowerCase().includes(q)).slice(0, 8);
  }, [search, students]);

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Review Queue</h1>
        <p className="text-ink-secondary text-sm mt-1">
          {loading ? "Loading…" : `${queue.length} ${queue.length === 1 ? "entry" : "entries"} awaiting review`}
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        </div>
      )}

      {!loading && queue.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-5">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">All clear</h2>
          <p className="text-ink-secondary text-sm mt-1.5 max-w-xs">
            No late entries are waiting on review right now — the recognition system is confident about everyone it&apos;s logged.
          </p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence>
          {queue.map((entry) => {
            const c = houseColour({ name: entry.house_name });
            const busy = busyId === entry.id;
            const reassigning = reassignId === entry.id;
            return (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <GlassCard hover={!busy} glowColour={c} className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="font-semibold text-white text-base">{entry.student_name || "Unidentified"}</div>
                      {entry.house_name && (
                        <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-ink-secondary">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                          {entry.house_name}
                        </span>
                      )}
                    </div>
                    <CircularProgress value={entry.confidence_score ?? 0} size={64} strokeWidth={5.5} colour="#f59e0b" />
                  </div>

                  <div className="flex items-center gap-3 text-xs text-ink-secondary mb-4">
                    <span>{entry.date}</span>
                    <span>·</span>
                    <span>{entry.arrival_time?.slice(0, 5)}</span>
                    <span>·</span>
                    <span>{entry.minutes_late} min late</span>
                    <Badge label={entry.status} />
                  </div>

                  <div className="mt-auto pt-2">
                    <AnimatePresence mode="wait">
                      {!reassigning ? (
                        <motion.div key="actions" className="flex gap-2" exit={{ opacity: 0 }}>
                          <Button variant="success" disabled={busy} className="flex-1 text-xs px-2 py-2"
                            onClick={() => act(entry.id, { status: "manually_verified" })}>
                            ✓ Confirm
                          </Button>
                          <Button variant="secondary" disabled={busy} className="flex-1 text-xs px-2 py-2"
                            onClick={() => { setReassignId(entry.id); setSearch(""); }}>
                            Wrong Person
                          </Button>
                          <Button variant="danger" disabled={busy} className="flex-1 text-xs px-2 py-2"
                            onClick={() => act(entry.id, { status: "unknown" })}>
                            ✕ Reject
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div key="reassign" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                          <input
                            autoFocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search student name or code…"
                            className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 focus:border-white/30 outline-none text-xs text-white"
                          />
                          <div className="max-h-32 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                            {filteredStudents.length === 0 && (
                              <div className="px-3 py-2 text-xs text-ink-faint">No matches</div>
                            )}
                            {filteredStudents.map((s: any) => (
                              <button
                                key={s.id}
                                disabled={busy}
                                onClick={() => act(entry.id, { student_id: s.id, status: "manually_verified" })}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                              >
                                <span className="text-white font-medium">{s.name}</span>
                                <span className="text-ink-faint ml-1.5">{s.student_code} · {s.house_name}</span>
                              </button>
                            ))}
                          </div>
                          <button onClick={() => setReassignId(null)} className="text-xs text-ink-secondary hover:text-white">Cancel</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
