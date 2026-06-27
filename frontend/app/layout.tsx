import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Attendify.ai — School House Management",
  description: "Late Entry Monitoring and House Points System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
