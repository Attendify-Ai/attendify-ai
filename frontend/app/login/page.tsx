"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { storeAuth, dashboardHome, roleLabel, AuthUser } from "@/lib/auth";
import Logo from "@/components/ui/Logo";
import { FloatingInput } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [welcomeUser, setWelcomeUser] = useState<AuthUser | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password);
      storeAuth(data.access_token, data.user);
      setWelcomeUser(data.user);
      setTimeout(() => router.replace(dashboardHome(data.user.role)), 900);
    } catch {
      setError("Invalid email or password");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Ambient animated background */}
      <div className="ambient-bg">
        <motion.div
          className="ambient-blob w-[520px] h-[520px] bg-indigo-600 -top-40 -left-40"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="ambient-blob w-[480px] h-[480px] bg-blue-600 top-1/3 -right-32"
          animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="ambient-blob w-[420px] h-[420px] bg-violet-700 bottom-0 left-1/4"
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mb-5"
          >
            <Logo size="xl" className="shadow-[0_0_60px_-10px_rgba(99,102,241,0.6)]" />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Attendify.ai</h1>
          <p className="text-ink-secondary text-sm mt-2">Intelligent Attendance. Real-time Results.</p>
        </div>

        <div className="glass-hi rounded-2xl shadow-glass p-8">
          <AnimatePresence mode="wait">
            {welcomeUser ? (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="text-center py-6"
              >
                <div className="w-12 h-12 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white font-semibold">Welcome back, {welcomeUser.name}</p>
                <p className="text-ink-secondary text-sm mt-1">{roleLabel(welcomeUser)}</p>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h2 className="text-lg font-semibold text-white mb-6">Sign in</h2>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-5 bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl px-4 py-3 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <FloatingInput
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                  />
                  <FloatingInput
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <Button type="submit" disabled={loading} className="w-full py-3 mt-2">
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : null}
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-ink-faint text-xs mt-6">
          Attendify.ai · House Management System
        </p>
      </motion.div>
    </div>
  );
}
