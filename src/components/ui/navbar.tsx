"use client";

import { usePathname } from "next/navigation";
import { AppSiteMenu } from "@/components/ui/app-site-menu";
import { cn } from "@/lib/utils";

/**
 * Global shell: on most routes shows a floating app menu. On `/workflow-canvas` the menu lives in the canvas top bar (beside Share).
 */
export function Navbar() {
  const pathname = usePathname();
  const onWorkflowCanvas = pathname.startsWith("/workflow-canvas");

  if (onWorkflowCanvas) {
    return (
      <header
        aria-label="Application navigation"
        className="pointer-events-none relative z-[200] h-0 w-full shrink-0"
      />
    );
  }

  return (
    <header
      aria-label="Application navigation"
      className="pointer-events-none relative z-[250] h-0 w-full shrink-0"
    >
      <AppSiteMenu
        className={cn(
          "pointer-events-auto fixed top-2 right-3 z-[251] flex h-9 w-9 items-center justify-center rounded-md border shadow-md transition",
          "border-border/80 bg-background/95 text-foreground backdrop-blur-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        zOverlay={252}
      />
    </header>
  );
}
