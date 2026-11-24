"use client";
import { useEffect, useState } from "react";
export function ThemeControls() {
  const [dark, setDark] = useState(false),
    [compact, setCompact] = useState(false);
  useEffect(() => {
    const d = localStorage.getItem("opsora-theme") === "dark",
      c = localStorage.getItem("opsora-sidebar") === "compact";
    document.documentElement.dataset.theme = d ? "dark" : "light";
    document.body.classList.toggle("sidebar-compact", c);
    const frame = requestAnimationFrame(() => {
      setDark(d);
      setCompact(c);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  function theme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("opsora-theme", next ? "dark" : "light");
    document.documentElement.dataset.theme = next ? "dark" : "light";
  }
  function sidebar() {
    const next = !compact;
    setCompact(next);
    localStorage.setItem("opsora-sidebar", next ? "compact" : "full");
    document.body.classList.toggle("sidebar-compact", next);
  }
  return (
    <div className="theme-controls">
      <button
        type="button"
        onClick={sidebar}
        className="icon-button desktop-only"
        aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
      >
        <i
          className={
            compact ? "ri-layout-right-2-line" : "ri-layout-left-2-line"
          }
        />
      </button>
      <button
        type="button"
        onClick={theme}
        className="icon-button"
        aria-label={dark ? "Use light theme" : "Use dark theme"}
      >
        <i className={dark ? "ri-sun-line" : "ri-moon-clear-line"} />
      </button>
    </div>
  );
}
