"use client";

import { useState } from "react";

export function GlobalSearch() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={`global-search-wrap${mobileOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="global-search-mobile-toggle"
        aria-label={mobileOpen ? "Close search" : "Open search"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((current) => !current)}
      >
        <i className={mobileOpen ? "ri-close-line" : "ri-search-line"} />
      </button>
      <form action="/search" method="get" className="global-search" role="search">
        <i className="ri-search-line" aria-hidden="true" />
        <input
          type="search"
          name="q"
          minLength={2}
          maxLength={100}
          placeholder="Search tasks, company users and reports"
          aria-label="Search tasks, company users and reports"
          required
        />
        <button type="submit" aria-label="Submit search">
          <i className="ri-arrow-right-line" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
