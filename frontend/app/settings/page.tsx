"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getCalendar, createCalendarEntry, deleteCalendarEntry, getHouses, getHouseHistory, resetPassword, getActivityLog } from "@/lib/api";
import api from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { houseColour } from "@/lib/houseTheme";

export default function SettingsPage() {
  const [tab, setTab] = useState<"calendar" | "users" | "history" | "activity">("calendar");

  const [houses, setHouses] = useState<any[]>([]);
  const [historyHouseId, setHistoryHouseId] = useState<string>("");
  const [pointHistory, setPointHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [calendar, setCalendar] = useState<any[]>([]);
  const [calendarForm, setCalendarForm] = useState({ date: "", label: "" });
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [savingCal, setSavingCal] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "teacher", assigned_class: "", assigned_house_id: "" });
  const [savingUser, setSavingUser] = useState(false);

  const [resetTarget, setResetTarget] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPw, setResettingPw] = useState(false);

  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityFilter, setActivityFilter] = useState("");

  const admin = isAdmin();

  const loadCalendar = () => getCalendar().then(setCalendar);
  const loadUsers = () => api.get("/auth/users").then((r) => setUsers(r.data)).catch(() => {});
  const loadActivity = () => {
    setLoadingActivity(true);
    getActivityLog(activityFilter ? { action: activityFilter } : undefined)
      .then((d) => setActivityLog(d.items || []))
      .finally(() => setLoadingActivity(false));
  };

  useEffect(() => {
    loadCalendar();
    loadUsers();
    getHouses().then((data) => {
      setHouses(data);
      if (data.length > 0) setHistoryHouseId(String(data[0].id));
    });
  }, []);

  useEffect(() => {
    if (tab === "activity") loadActivity();
  }, [tab, activityFilter]);

  useEffect(() => {
    if (!historyHouseId) return;
    setLoadingHistory(true);
    getHouseHistory(Number(historyHouseId))
      .then((d) => setPointHistory(d.history || []))
      .finally(() => setLoadingHistory(false));
  }, [historyHouseId]);

  const handleCalendarAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCal(true);
    try {
      await createCalendarEntry({ date: calendarForm.date, label: calendarForm.label });
      setShowCalendarModal(false);
      setCalendarForm({ date: "", label: "" });
      loadCalendar();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error adding entry");
    } finally {
      setSavingCal(false);
    }
  };

  const handleCalendarDelete = async (id: number) => {
    if (!confirm("Remove this non-school day?")) return;
    await deleteCalendarEntry(id);
    loadCalendar();
  };

  const handleUserAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      const payload: any = { name: userForm.name, email: userForm.email, password: userForm.password, role: userForm.role };
      if (userForm.role === "teacher" && userForm.assigned_class) payload.assigned_class = userForm.assigned_class;
      if (userForm.role === "house_manager" && userForm.assigned_house_id) payload.assigned_house_id = Number(userForm.assigned_house_id);
      await api.post("/auth/register", payload);
      setShowUserModal(false);
      setUserForm({ name: "", email: "", password: "", role: "teacher", assigned_class: "", assigned_house_id: "" });
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error creating user");
    } finally {
      setSavingUser(false);
    }
  };

  const handleUserDelete = async (id: number, name: string) => {
    if (!confirm(`Remove user ${name}?`)) return;
    await api.delete(`/auth/users/${id}`).catch((e) => alert(e.response?.data?.detail || "Error"));
    loadUsers();
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResettingPw(true);
    try {
      await resetPassword(resetTarget.id, newPassword);
      setResetTarget(null);
      setNewPassword("");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error resetting password");
    } finally {
      setResettingPw(false);
    }
  };

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">School calendar and user management</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
        {(["calendar", "users", "history", "activity"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-white dark:bg-slate-700 shadow text-gray-900 dark:text-white" : "text-gray-500 dark:text-slate-400"
            }`}>
            {t === "calendar" ? "School Calendar" : t === "users" ? "Users" : t === "history" ? "Point History" : "Activity Log"}
          </button>
        ))}
      </div>

      {tab === "calendar" && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Non-School Days</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Camera service skips scanning on these dates.</p>
            </div>
            {admin && (
              <button onClick={() => setShowCalendarModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2 rounded-lg font-medium">
                + Add Holiday
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {calendar.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">No holidays or non-school days added</div>
            )}
            {calendar.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <span className="font-medium text-sm">{e.date}</span>
                  <span className="ml-3 text-gray-500 text-sm">{e.label}</span>
                </div>
                {admin && (
                  <button onClick={() => handleCalendarDelete(e.id)} className="text-red-500 text-xs hover:underline">
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "users" && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">System Users</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Admins and teachers who can access this system.</p>
            </div>
            {admin && (
              <button onClick={() => setShowUserModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2 rounded-lg font-medium">
                + Add User
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Assigned</th>
                  <th className="px-5 py-3 font-medium">Last Login</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  {admin && <th className="px-5 py-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="px-5 py-3 font-medium">{u.name}</td>
                    <td className="px-5 py-3 text-gray-500">{u.email}</td>
                    <td className="px-5 py-3"><Badge label={u.role} /></td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{u.assigned_class || u.assigned_house_name || "—"}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{u.created_at?.slice(0, 10)}</td>
                    {admin && (
                      <td className="px-5 py-3 whitespace-nowrap">
                        <button onClick={() => setResetTarget(u)} className="text-indigo-500 text-xs hover:underline mr-3">
                          Reset Password
                        </button>
                        <button onClick={() => handleUserDelete(u.id, u.name)} className="text-red-500 text-xs hover:underline">
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "activity" && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold">Activity Log</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Who did what, and when.</p>
            </div>
            <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs">
              <option value="">All actions</option>
              <option value="logged_in">Logged in</option>
              <option value="verified_entry">Verified entry</option>
              <option value="marked_wrong_person">Marked wrong person</option>
              <option value="adjusted_points">Adjusted points</option>
              <option value="added_student">Added student</option>
              <option value="deleted_student">Deleted student</option>
              <option value="reset_password">Reset password</option>
              <option value="weekly_report_generated">Weekly report generated</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                  <th className="px-5 py-3 font-medium">Teacher Name</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Details</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {loadingActivity && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
                )}
                {!loadingActivity && activityLog.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">No activity recorded yet</td></tr>
                )}
                {!loadingActivity && activityLog.map((entry: any) => (
                  <tr key={entry.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="px-5 py-3 font-medium">{entry.user_name}</td>
                    <td className="px-5 py-3"><Badge label={entry.action} dot={false} /></td>
                    <td className="px-5 py-3 text-gray-500">{entry.details}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "history" && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold">Point Adjustment History</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Timeline of manual adjustments and late-entry deductions per house.</p>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {houses.map((h: any) => (
                <button
                  key={h.id}
                  onClick={() => setHistoryHouseId(String(h.id))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    historyHouseId === String(h.id)
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: houseColour(h) }} />
                  {h.name}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            {loadingHistory && (
              <div className="px-6 py-10 text-center text-gray-400 text-sm">Loading…</div>
            )}
            {!loadingHistory && pointHistory.length === 0 && (
              <div className="px-6 py-10 text-center text-gray-400 text-sm">No point history for this house yet</div>
            )}
            {!loadingHistory && pointHistory.length > 0 && (
              <div className="px-6 py-5">
                <ol className="relative border-l border-gray-200 dark:border-slate-700 ml-2 space-y-6">
                  {pointHistory.map((h: any, i: number) => (
                    <li key={i} className="ml-5">
                      <span
                        className={`absolute -left-[5px] w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-slate-800 ${
                          h.points > 0 ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <span className="font-medium text-sm text-gray-800 dark:text-slate-200">{h.reason}</span>
                          {h.by && <span className="text-gray-400 ml-2 text-xs">by {h.by}</span>}
                        </div>
                        <span className={`font-bold text-sm shrink-0 ${h.points > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                          {h.points > 0 ? "+" : ""}{h.points}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{h.at ? new Date(h.at).toLocaleString() : ""}</div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </Card>
      )}

      <Modal open={showCalendarModal} onClose={() => setShowCalendarModal(false)} title="Add Non-School Day">
        <form onSubmit={handleCalendarAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Date</label>
            <input type="date" value={calendarForm.date} onChange={(e) => setCalendarForm((f) => ({ ...f, date: e.target.value }))} required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Label</label>
            <input value={calendarForm.label} onChange={(e) => setCalendarForm((f) => ({ ...f, label: e.target.value }))} required
              placeholder="e.g. Diwali Holiday"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowCalendarModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={savingCal} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {savingCal ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showUserModal} onClose={() => setShowUserModal(false)} title="Add User">
        <form onSubmit={handleUserAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Full Name</label>
            <input value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input type="email" value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input type="password" value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Role</label>
            <select value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm">
              <option value="teacher">Teacher</option>
              <option value="house_manager">House Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {userForm.role === "teacher" && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Assigned Class</label>
              <input value={userForm.assigned_class} onChange={(e) => setUserForm((f) => ({ ...f, assigned_class: e.target.value }))}
                placeholder="e.g. 7B"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
            </div>
          )}
          {userForm.role === "house_manager" && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Assigned House</label>
              <select value={userForm.assigned_house_id} onChange={(e) => setUserForm((f) => ({ ...f, assigned_house_id: e.target.value }))} required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm">
                <option value="">Select a house…</option>
                {houses.map((h: any) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={savingUser} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {savingUser ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!resetTarget} onClose={() => { setResetTarget(null); setNewPassword(""); }} title={`Reset Password — ${resetTarget?.name || ""}`}>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setResetTarget(null); setNewPassword(""); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={resettingPw} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {resettingPw ? "Resetting…" : "Reset Password"}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
