"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <SessionProvider>{children}</SessionProvider>
    </ClerkProvider>
  );
}
