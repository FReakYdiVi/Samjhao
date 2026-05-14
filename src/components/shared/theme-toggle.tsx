"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedTheme =
        window.localStorage.getItem("samjhao-theme") === "dark" ? "dark" : "light";
      setTheme(storedTheme);
      setMounted(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    applyTheme(theme);
    window.localStorage.setItem("samjhao-theme", theme);
  }, [mounted, theme]);

  function updateTheme(nextTheme: Theme) {
    setTheme(nextTheme);
  }

  const lightActive = mounted && theme === "light";
  const darkActive = mounted && theme === "dark";

  return (
    <div className="inline-flex items-center rounded-full border border-[#e0d4c4] bg-white/75 p-1 dark:border-white/12 dark:bg-white/6">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={
          lightActive
            ? "rounded-full bg-[#fff2da] text-[#9c6200] hover:bg-[#fff2da] dark:bg-white/10 dark:text-white"
            : "rounded-full text-neutral-500 hover:bg-[#f7ecdc] hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
        }
        onClick={() => updateTheme("light")}
      >
        <Sun className="mr-1.5 h-4 w-4" />
        Light
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={
          darkActive
            ? "rounded-full bg-neutral-900 text-white hover:bg-neutral-900 dark:bg-white dark:text-neutral-950"
            : "rounded-full text-neutral-500 hover:bg-[#f7ecdc] hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
        }
        onClick={() => updateTheme("dark")}
      >
        <Moon className="mr-1.5 h-4 w-4" />
        Dark
      </Button>
    </div>
  );
}
