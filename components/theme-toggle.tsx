"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-10"
      aria-label={label}
      title={label}
      onClick={toggleTheme}
    >
      {isDark === null ? (
        <SunMoon aria-hidden="true" />
      ) : isDark ? (
        <Sun aria-hidden="true" />
      ) : (
        <Moon aria-hidden="true" />
      )}
    </Button>
  );
}
