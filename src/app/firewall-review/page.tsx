"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Dashboard from "@/modules/firewall-review/dashboard-page";

const ALLOWED_ROLES = new Set(["admin", "arb_reviewer", "architect"]);

export default function FirewallReviewPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "").toLowerCase();
  const isAllowed = ALLOWED_ROLES.has(role);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.replace("/auth/signin");
      return;
    }
    if (!isAllowed) {
      router.replace("/unauthorized");
    }
  }, [status, session, isAllowed, router]);

  if (status === "loading" || !session?.user || !isAllowed) {
    return null;
  }

  return <Dashboard />;
}
