"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import AppShell from "@/components/layout/AppShell";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import Skeleton from "@/components/ui/Skeleton";
import { getSummary, getReviewQueue, getLateEntries } from "@/lib/api";
import { getStoredUser, dashboardHome } from "@/lib/auth";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function TeacherDashboardPage() {
  const router = useRouter();
  const user = getStoredUser();

  useEffect(() => {
    if (user && user.role !== "teacher") router.replace(dashboardHome(user.role));
  }, [user, router]);

  const [summary, setSummary] = useState<any>(null);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const params: any = { page_size: "10" };
    if (user?.assigned_class) params.class_ = user?.assigned_class;
    const [summaryData, queueData, recentData] = await Promise.all([
      getSummary(),
      getReviewQueue(),
      getLateEntries(params),
    ]);
    setSummary(summaryData);
    setReviewQueue(queueData);
    setRecent(recentData.items || []);
    setLoading(false);
  }, [user?.assigned_class]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          {greeting()}, {user?.name}
        </h1>
        <p className="text-ink-secondary text-sm mt-1">
          Class Teacher{user?.assigned_class ? ` · ${user?.assigned_class}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <GlassCard className="p-6">
          <p className="text-ink-secondary text-xs font-medium uppercase tracking-wide mb-2">Review Queue</p>
          {loading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <AnimatedNumber value={reviewQueue.length} className="text-3xl font-bold text-white" />
          )}
          <p className="text-ink-faint text-xs mt-1">entries needing review</p>
        </GlassCard>
        <GlassCard className="p-6">
          <p className="text-ink-secondary text-xs font-medium uppercase tracking-wide mb-2">Late Today</p>
          {loading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <AnimatedNumber value={summary?.today_late_count || 0} className="text-3xl font-bold text-white" />
          )}
          <p className="text-ink-faint text-xs mt-1">school-wide, today</p>
        </GlassCard>
        <GlassCard className="p-6">
          <p className="text-ink-secondary text-xs font-medium uppercase tracking-wide mb-2">Total Students</p>
          {loading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <AnimatedNumber value={summary?.total_students || 0} className="text-3xl font-bold text-white" />
          )}
          <p className="text-ink-faint text-xs mt-1">enrolled in the system</p>
        </GlassCard>
      </div>

      <div className="flex gap-3 mb-8">
        <Link
          href="/review-queue"
          className="bg-white text-black text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-white/90 transition-colors"
        >
          Go to Review Queue
        </Link>
        <Link
          href="/late-entries"
          className="glass text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:border-white/20 transition-colors"
        >
          View Late Entries
        </Link>
      </div>

      <GlassCard>
        <div className="px-6 py-4 border-b border-white/8">
          <h2 className="text-base font-semibold text-white">
            {user?.assigned_class ? `Recent Late Entries — ${user?.assigned_class}` : "Recent Late Entries"}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-secondary border-b border-white/8">
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Class</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Minutes Late</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-ink-faint">
                    No late entries yet
                  </td>
                </tr>
              )}
              {recent.map((entry: any) => (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="px-5 py-3 font-medium text-white">{entry.student_name || "Unknown"}</td>
                  <td className="px-5 py-3 text-ink-secondary">{entry.student_class}</td>
                  <td className="px-5 py-3 text-ink-secondary">{entry.date}</td>
                  <td className="px-5 py-3 text-ink-secondary">{entry.minutes_late} min</td>
                  <td className="px-5 py-3">
                    <Badge label={entry.status} />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </AppShell>
  );
}
