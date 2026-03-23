"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/modules/workflow-canvas/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/workflow-canvas/components/ui/dropdown-menu";

const themes = [
  {
    label: "Light",
    icon: SunIcon,
    value: "light",
  },
  {
    label: "Dark",
    icon: MoonIcon,
    value: "dark",
  },
  {
    label: "System",
    icon: MonitorIcon,
    value: "system",
  },
] as const;

export const ThemeSwitcher = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayTheme = theme === "system" ? resolvedTheme : theme;

  return (
    <div className="relative z-[200]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Select color theme"
            className="size-11 rounded-full border-2 border-slate-600/80 bg-white text-slate-900 shadow-md hover:bg-slate-50 hover:text-slate-950 dark:border-slate-400 dark:bg-slate-800 dark:text-amber-100 dark:hover:bg-slate-700 dark:hover:text-amber-50"
            size="icon"
            variant="outline"
          >
            {!mounted ? (
              <SunIcon aria-hidden className="size-[18px] opacity-50" />
            ) : theme === "system" ? (
              <MonitorIcon aria-hidden className="size-[18px]" strokeWidth={2.25} />
            ) : displayTheme === "dark" ? (
              <MoonIcon aria-hidden className="size-[18px]" strokeWidth={2.25} />
            ) : (
              <SunIcon aria-hidden className="size-[18px]" strokeWidth={2.25} />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="z-[400] min-w-36 border-2 border-border bg-popover shadow-lg"
          sideOffset={8}
        >
          {themes.map((themeOption) => {
            const Icon = themeOption.icon;
            const isActive = theme === themeOption.value;
            return (
              <DropdownMenuItem
                className={isActive ? "bg-accent font-medium" : ""}
                key={themeOption.value}
                onClick={() => setTheme(themeOption.value)}
              >
                <Icon aria-hidden className="size-4 text-foreground" strokeWidth={2} />
                <span>{themeOption.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
