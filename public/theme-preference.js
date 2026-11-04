try {
  const savedTheme = window.localStorage.getItem("job-search-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme === "dark" || (savedTheme !== "light" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
} catch {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", isDark);
}
