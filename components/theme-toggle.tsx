"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Switch } from "@/components/ui/switch";

const themeStorageKey = "job-search-theme";
const themeChangeEvent = "job-search-theme-change";

function getSavedTheme() {
  try {
    return window.localStorage.getItem(themeStorageKey);
  } catch (error) {
    console.error("Could not read the color theme preference:", error);
    return null;
  }
}

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
}

function subscribe(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function handleSystemChange() {
    if (getSavedTheme() === null) {
      applyTheme(mediaQuery.matches);
      onStoreChange();
    }
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key !== themeStorageKey && event.key !== null) return;
    const savedTheme = event.key === null ? null : event.newValue;
    applyTheme(
      savedTheme === "dark" ||
        (savedTheme !== "light" && mediaQuery.matches),
    );
    onStoreChange();
  }

  window.addEventListener(themeChangeEvent, onStoreChange);
  window.addEventListener("storage", handleStorageChange);
  mediaQuery.addEventListener("change", handleSystemChange);

  return () => {
    window.removeEventListener(themeChangeEvent, onStoreChange);
    window.removeEventListener("storage", handleStorageChange);
    mediaQuery.removeEventListener("change", handleSystemChange);
  };
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore<boolean | null>(
    subscribe,
    getSnapshot,
    () => null,
  );

  function toggleTheme() {
    const nextIsDark = !document.documentElement.classList.contains("dark");
    applyTheme(nextIsDark);
    window.dispatchEvent(new Event(themeChangeEvent));

    try {
      window.localStorage.setItem(
        themeStorageKey,
        nextIsDark ? "dark" : "light",
      );
    } catch (error) {
      console.error("Could not save the color theme preference:", error);
    }
  }

  const label =
    isDark === null
      ? "Toggle color theme"
      : isDark
        ? "Switch to light mode"
        : "Switch to dark mode";

  return (
    <Switch
      size="theme"
      checked={isDark === true}
      disabled={isDark === null}
      aria-label={label}
      title={label}
      onCheckedChange={toggleTheme}
    >
      <span className="absolute left-1 top-1 z-10 flex size-8 items-center justify-center rounded-full text-muted-foreground group-data-[unchecked]/switch:text-foreground dark:group-data-[unchecked]/switch:text-background">
        <Sun aria-hidden="true" className="size-4" />
      </span>
      <span className="absolute right-1 top-1 z-10 flex size-8 items-center justify-center rounded-full text-muted-foreground group-data-[checked]/switch:text-foreground">
        <Moon aria-hidden="true" className="translate-x-px size-4" />
      </span>
    </Switch>
  );
}
