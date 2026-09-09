"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuth, getStoredUser, dashboardHome } from "@/lib/auth";
import Logo from "@/components/ui/Logo";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/late-entries", label: "Late Entries" },
  { href: "/review-queue", label: "Review Queue" },
  { href: "/students", label: "Students" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings", adminOnly: true },
];

const houseManagerItems = [
  { href: "/house-dashboard", label: "Dashboard" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getStoredUser();

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const items =
    user?.role === "house_manager"
      ? houseManagerItems
      : (user?.role === "admin" ? navItems : navItems.filter((i) => !i.adminOnly)).map((i) =>
          i.href === "/dashboard" ? { ...i, href: dashboardHome(user?.role) } : i
        );
  const initials = (user?.name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 glass border-b border-white/8">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center gap-6">
        <Link href={dashboardHome(user?.role)} className="flex items-center gap-2.5 shrink-0">
          <Logo size="sm" />
          <span className="font-semibold tracking-tight text-white hidden sm:block">Attendify.ai</span>
        </Link>

        <nav className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
                  active ? "text-white" : "text-ink-secondary hover:text-white"
                }`}
              >
                {active && (
                  <span className="absolute inset-0 bg-white/8 rounded-lg border border-white/10" />
                )}
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex flex-col items-end leading-tight">
            <span className="text-sm font-medium text-white">{user?.name}</span>
            <span className="text-[11px] text-ink-secondary capitalize">{user?.role?.replace(/_/g, " ")}</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-ink-secondary hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
