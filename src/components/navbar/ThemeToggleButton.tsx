"use client";

import React, { useEffect, useState } from "react";
import { FaMoon, FaSun } from "react-icons/fa";

const ThemeToggleButton: React.FC = () => {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
        return;
      }
    } catch { /* ignore */ }

    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // apply both data-theme and Tailwind's 'dark' class for compatibility
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    try { localStorage.setItem("theme", theme); } catch { /* ignore */ }
  }, [theme, mounted]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  if (!mounted) return null;

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title="Toggle theme"
      className={`
        flex items-center justify-center w-9 h-9 rounded-full
        border dark:border-gray-600
        bg-white dark:bg-gray-800
        shadow-sm hover:scale-105 transition-transform
      `}
    >
      {theme === "light" ? (
        <FaMoon className="text-black" />
      ) : (
        <FaSun className="text-yellow-400" />
      )}
    </button>
  );
};

export default ThemeToggleButton;
