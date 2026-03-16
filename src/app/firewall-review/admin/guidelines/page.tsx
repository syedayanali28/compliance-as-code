"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import GuidelinesAdminPage from "@/modules/firewall-review/guidelines-admin-page";

const ALLOWED_ROLES = new Set(["admin"]);

export default function FirewallGuidelinesAdminRoute() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const rawRole = user?.publicMetadata?.role;
  const role = typeof rawRole === "string" ? rawRole.toLowerCase() : "";
  const isAllowed = ALLOWED_ROLES.has(role);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    if (!isAllowed) {
      router.replace("/unauthorized");
    }
  }, [isLoaded, isSignedIn, isAllowed, router]);

  if (!isLoaded || !isSignedIn || !isAllowed) {
    return null;
  }

  return <GuidelinesAdminPage />;
}
