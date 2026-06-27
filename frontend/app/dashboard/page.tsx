"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getHouses, getSummary, getLateEntries } from "@/lib/api";

const HOUSE_COLORS = ["from-yellow-400 to-orange-500", "from-red-400 to-pink-500", "from-blue-400 to-cyan-500", "from-green-400 to-teal-500"];
const RANK_MEDALS = ["🥇", "🥈", "🥉", "4️⃣"];

export default function DashboardPage() {
  const [houses, setHouses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      getHouses().then(setHouses),
      getSummary().then(setSummary),
      getLateEntries({ page_size: "10" } as any).then((d) => setRecent(d.items || [])),
    ]).catch(console.error);
  }, []);

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <Card className="p-5">
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{summary?.today_late_count ?? "–"}</div>
          <div className="text-sm text-gray-500 dark:text-slate-400 mt-1">Late today</div>
        </Card>
        <Card className="p-5">
          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{summary?.review_queue_count ?? "–"}</div>
          <div className="text-sm text-gray-500 dark:text-slate-400 mt-1">Pending review</div>
        </Card>
        <Card className="p-5">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">{summary?.total_students ?? "–"}</div>
          <div className="text-sm text-gray-500 dark:text-slate-400 mt-1">Total students</div>
        </Card>
      </div>

      {/* House Leaderboard */}
      <Card className="mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-base font-semibold">House Leaderboard</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
          {houses.map((house, idx) => (
            <div
              key={house.id}
              className={`rounded-xl bg-gradient-to-br ${HOUSE_COLORS[idx % HOUSE_COLORS.length]} p-5 text-white`}
            >
              <div className="text-2xl mb-1">{RANK_MEDALS[house.rank - 1]}</div>
              <div className="font-bold text-lg">{house.name}</div>
              <div className="text-3xl font-extrabold mt-2">{house.current_points}</div>
              <div className="text-xs opacity-80 mt-0.5">points</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Late Entries */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-base font-semibold">Recent Late Entries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                <th className="px-6 py-3 font-medium">Student</th>
                <th className="px-6 py-3 font-medium">House</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Min Late</th>
                <th className="px-6 py-3 font-medium">Points</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                    No late entries yet
                  </td>
                </tr>
              )}
              {recent.map((e: any) => (
                <tr key={e.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                  <td className="px-6 py-3 font-medium">{e.student_name || "Unknown"}</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-slate-400">{e.house_name}</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-slate-400">{e.date}</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-slate-400">{e.arrival_time?.slice(0, 5)}</td>
                  <td className="px-6 py-3">{e.minutes_late} min</td>
                  <td className="px-6 py-3 text-red-600 dark:text-red-400 font-semibold">-{e.points_deducted}</td>
                  <td className="px-6 py-3">
                    <Badge label={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
