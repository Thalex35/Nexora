import { SunMoon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const nextTheme = root.classList.contains("dark") ? "light" : "dark";
    root.classList.toggle("dark", nextTheme === "dark");
    root.style.colorScheme = nextTheme;

    try {
      localStorage.setItem("nexora-theme", nextTheme);
    } catch {
      // The current session still changes theme when persistent storage is unavailable.
    }
    window.dispatchEvent(new Event("nexora-theme-change"));
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle light and dark appearance"
      title="Toggle light and dark appearance"
      onClick={toggleTheme}
    >
      <SunMoon aria-hidden="true" />
    </Button>
  );
}
