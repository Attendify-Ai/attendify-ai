"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import GlassCard from "@/components/ui/GlassCard";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import Skeleton from "@/components/ui/Skeleton";
import { getHouseManagerReport, downloadHouseManagerReport } from "@/lib/api";
import { getStoredUser, dashboardHome } from "@/lib/auth";
import { houseColour, hexToRgb } from "@/lib/houseTheme";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const RANK_SUFFIX = ["st", "nd", "rd"];
function ordinal(n: number) {
  const suffix = n <= 3 ? RANK_SUFFIX[n - 1] : "th";
  return `${n}${suffix}`;
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (diff === 0) return <span className="text-ink-faint text-xs">No change vs last week</span>;
  const better = diff < 0; // fewer late entries / points lost is better
  return (
    <span className={`text-xs font-medium ${better ? "text-green-400" : "text-red-400"}`}>
      {diff > 0 ? "+" : ""}
      {diff} vs last week
    </span>
  );
}

export default function HouseDashboardPage() {
  const router = useRouter();
  const user = getStoredUser();

  useEffect(() => {
    if (user && user.role !== "house_manager") router.replace(dashboardHome(user.role));
  }, [user, router]);

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getHouseManagerReport();
    setReport(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      await downloadHouseManagerReport(report.house_name, report.week_start);
    } finally {
      setDownloading(false);
    }
  };

  const colour = report ? houseColour({ name: report.house_name, colour: report.house_colour }) : "#6366f1";

  return (
    <AppShell>
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {loading ? <Skeleton className="h-8 w-40" /> : report?.house_name}
          </h1>
          <p className="text-ink-secondary text-sm mt-1">
            House Manager Dashboard {report ? `· Week of ${report.week_start}` : ""}
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={loading || downloading}
          className="bg-white text-black text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {downloading ? "Preparing…" : "Download Weekly Report (Excel)"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <GlassCard className="p-6" glowColour={colour}>
          <p className="text-ink-secondary text-xs font-medium uppercase tracking-wide mb-2">Current Points</p>
          {loading ? (
            <Skeleton className="h-9 w-20" />
          ) : (
            <AnimatedNumber value={report?.current_points || 0} className="text-3xl font-bold text-white" />
          )}
          <p className="text-ink-faint text-xs mt-1">
            {loading ? "" : report?.rank ? `${ordinal(report.rank)} place overall` : ""}
          </p>
        </GlassCard>
        <GlassCard className="p-6">
          <p className="text-ink-secondary text-xs font-medium uppercase tracking-wide mb-2">Late Entries This Week</p>
          {loading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <>
              <AnimatedNumber value={report?.this_week.late_entries || 0} className="text-3xl font-bold text-white" />
              <div className="mt-1">
                <Delta current={report?.this_week.late_entries || 0} previous={report?.last_week.late_entries || 0} />
              </div>
            </>
          )}
        </GlassCard>
        <GlassCard className="p-6">
          <p className="text-ink-secondary text-xs font-medium uppercase tracking-wide mb-2">Points Lost This Week</p>
          {loading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <>
              <AnimatedNumber value={report?.this_week.points_lost || 0} className="text-3xl font-bold text-white" />
              <div className="mt-1">
                <Delta current={report?.this_week.points_lost || 0} previous={report?.last_week.points_lost || 0} />
              </div>
            </>
          )}
        </GlassCard>
      </div>

      <GlassCard className="mb-6">
        <div className="px-6 pt-5 pb-4 border-b border-white/8">
          <h2 className="text-base font-semibold text-white">Late Entries This Week</h2>
        </div>
        <div className="p-6">
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={report.daily_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="count" name="Late Entries" fill={colour} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </GlassCard>

      <GlassCard>
        <div className="px-6 py-4 border-b border-white/8">
          <h2 className="text-base font-semibold text-white">Top 5 Most Frequent Late Students This Week</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-secondary border-b border-white/8">
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Class</th>
                <th className="px-5 py-3 font-medium">Late Count</th>
              </tr>
            </thead>
            <tbody>
              {!loading && (!report?.top_students || report.top_students.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-ink-faint">
                    No late entries this week
                  </td>
                </tr>
              )}
              {report?.top_students.map((s: any, i: number) => (
                <tr key={s.student_id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-5 py-3 text-ink-faint font-medium">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-white">{s.name}</td>
                  <td className="px-5 py-3 text-ink-secondary font-mono text-xs">{s.student_code}</td>
                  <td className="px-5 py-3 text-ink-secondary">{s.class}</td>
                  <td className="px-5 py-3 font-bold text-orange-400">{s.late_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </AppShell>
  );
}
