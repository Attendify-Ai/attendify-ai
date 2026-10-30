"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { sendChatMessage } from "@/lib/api";
import { getStoredUser, roleLabel } from "@/lib/auth";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const WELCOME_TEXT =
  "Hi! I'm your Attendify AI Assistant. Ask me about late entries, house points, the review queue, or student attendance.";

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([{ role: "assistant", content: WELCOME_TEXT }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const user = getStoredUser();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const { response } = await sendChatMessage(text, history);
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail || "Something went wrong talking to the AI assistant. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: detail }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-24 right-6 z-50 w-[400px] h-[500px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-7rem)] glass-hi rounded-2xl shadow-glass flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0 bg-white/[0.02]">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">Attendify AI Assistant</p>
                <p className="text-[11px] text-ink-secondary flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-glow" />
                  {user ? roleLabel(user) : "Online"}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-blue-600 text-white rounded-br-md"
                        : "bg-white/[0.06] border border-white/10 text-ink-secondary rounded-bl-md"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.06] border border-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-ink-secondary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10 shrink-0 flex items-end gap-2 bg-white/[0.02]">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about late entries, houses, students…"
                className="flex-1 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 focus:border-white/40 px-3.5 py-2.5 text-sm text-white outline-none transition-colors duration-200 placeholder:text-ink-faint"
              />
              <motion.button
                whileHover={input.trim() && !loading ? { scale: 1.05 } : undefined}
                whileTap={input.trim() && !loading ? { scale: 0.95 } : undefined}
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shrink-0 disabled:opacity-30 disabled:pointer-events-none transition-opacity"
                aria-label="Send message"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating toggle button */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-white text-black shadow-[0_8px_30px_-6px_rgba(255,255,255,0.35),0_0_0_1px_rgba(255,255,255,0.1)] flex items-center justify-center"
        aria-label={open ? "Close Attendify AI Assistant" : "Open Attendify AI Assistant"}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.svg
              key="close"
              initial={{ opacity: 0, rotate: -45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 45 }}
              transition={{ duration: 0.15 }}
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </motion.svg>
          ) : (
            <motion.svg
              key="chat"
              initial={{ opacity: 0, rotate: 45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -45 }}
              transition={{ duration: 0.15 }}
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
