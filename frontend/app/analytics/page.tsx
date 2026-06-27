"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import { getLateTrend, getHousePerformance, getFrequentOffenders, getExportUrl } from "@/lib/api";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const HOUSE_COLORS = ["#6366f1", "#f43f5e", "#0ea5e9", "#10b981"];

export default function AnalyticsPage() {
  const [trend, setTrend] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [offenders, setOffenders] = useState<any[]>([]);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  useEffect(() => {
    getLateTrend({ period }).then(setTrend);
    getHousePerformance().then(setPerformance);
    getFrequentOffenders({ limit: "10" } as any).then(setOffenders);
  }, [period]);

  const handleExport = () => {
    const url = getExportUrl();
    const a = document.createElement("a");
    a.href = url;
    a.click();
  };

  const trendKey = period === "daily" ? "date" : period === "weekly" ? "week" : "month";

  return (
    <AppShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Late entry patterns and house performance</p>
        </div>
        <button onClick={handleExport}
          className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-sm px-4 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors">
          Export CSV
        </button>
      </div>

      {/* Late Entry Trend */}
      <Card className="mb-6">
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-base font-semibold">Late Entry Trend</h2>
          <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
            {(["daily", "weekly", "monthly"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded-md font-medium capitalize transition-colors ${
                  period === p ? "bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white" : "text-gray-500 dark:text-slate-400"
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="p-6">
          {trend.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey={trendKey} tick={{ fontSize: 11 }} tickFormatter={(v) => v?.slice(0, 10) || v} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", fontSize: "12px" }} />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} name="Late Entries" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* House Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700">
            <h2 className="text-base font-semibold">House Standing</h2>
          </div>
          <div className="p-6">
            {performance.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={performance} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="current_points" name="Points Remaining" radius={[4, 4, 0, 0]}>
                    {performance.map((_, i) => (
                      <rect key={i} fill={HOUSE_COLORS[i % HOUSE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700">
            <h2 className="text-base font-semibold">Late Entries per House</h2>
          </div>
          <div className="p-6">
            {performance.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={performance} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="total_late_entries" name="Late Entries" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Frequent Offenders */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-base font-semibold">Most Frequent Late Students</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Class</th>
                <th className="px-5 py-3 font-medium">House</th>
                <th className="px-5 py-3 font-medium">Late Count</th>
                <th className="px-5 py-3 font-medium">Points Lost</th>
              </tr>
            </thead>
            <tbody>
              {offenders.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No data yet</td></tr>
              )}
              {offenders.map((o: any, i: number) => (
                <tr key={o.student_id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                  <td className="px-5 py-3 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-5 py-3 font-medium">{o.name}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{o.student_code}</td>
                  <td className="px-5 py-3">{o.class}</td>
                  <td className="px-5 py-3">{o.house}</td>
                  <td className="px-5 py-3 font-bold text-orange-600 dark:text-orange-400">{o.late_count}</td>
                  <td className="px-5 py-3 font-semibold text-red-500 dark:text-red-400">-{o.total_points_deducted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
