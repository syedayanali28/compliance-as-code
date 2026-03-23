import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/ui/navbar";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "IdaC Compliance Platform",
  description:
    "Infrastructure-design-as-Code compliance and validation platform for HKMA IT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <Providers>
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <Navbar />
            <main className="flex-1 min-h-0">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
