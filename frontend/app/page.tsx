"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const user = getStoredUser();
    router.replace(user ? "/dashboard" : "/login");
  }, [router]);
  return null;
}
