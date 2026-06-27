"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuth, getStoredUser } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "⬛" },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
  { href: "/late-entries", label: "Late Entries", icon: "📋" },
  { href: "/scan", label: "Scan", icon: "📷" },
  { href: "/students", label: "Students", icon: "👤", adminOnly: true },
  { href: "/analytics", label: "Analytics", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️", adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getStoredUser();

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const items = user?.role === "admin" ? navItems : navItems.filter((i) => !i.adminOnly);

  return (
    <aside className="w-60 min-h-screen flex flex-col bg-slate-800 dark:bg-slate-900 text-slate-100 shrink-0">
      <div className="px-6 py-5 border-b border-slate-700">
        <div className="text-xl font-bold text-white tracking-tight">Attendify.ai</div>
        <div className="text-xs text-slate-400 mt-0.5">House Management System</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4 border-t border-slate-700 pt-4">
        <div className="px-3 mb-2">
          <div className="text-sm font-medium text-slate-200">{user?.name}</div>
          <div className="text-xs text-slate-400 capitalize">{user?.role}</div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
