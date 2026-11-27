"use client";

import { useState } from "react";
import { toggleChecklistItem } from "@/app/(app)/tasks/[id]/actions";

type ChecklistItem = { id: string; label: string; completed: boolean; completed_at: string | null };

export function TaskChecklist({ taskId, initialItems, canUpdate }: { taskId: string; initialItems: ChecklistItem[]; canUpdate: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const completed = items.filter((item) => item.completed).length;
  const percentage = items.length ? Math.round((completed / items.length) * 100) : 0;

  async function toggle(item: ChecklistItem) {
    if (!canUpdate || pending) return;
    const next = !item.completed;
    setPending(item.id);
    setError("");
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, completed: next } : entry));
    try {
      await toggleChecklistItem({ taskId, itemId: item.id, completed: next });
    } catch (reason) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, completed: item.completed } : entry));
      setError(reason instanceof Error ? reason.message : "Unable to update checklist");
    } finally {
      setPending(null);
    }
  }

  if (!items.length) return null;
  return (
    <section className="panel p-4 mb-3 task-checklist-card">
      <div className="task-checklist-summary">
        <div><span>Work checklist</span><h2>{completed} of {items.length} completed</h2></div>
        <strong>{percentage}%</strong>
      </div>
      <div className="task-checklist-progress"><span style={{ width: `${percentage}%` }} /></div>
      <div className="task-checklist-items">
        {items.map((item) => (
          <label className={item.completed ? "is-complete" : ""} key={item.id}>
            <input type="checkbox" checked={item.completed} disabled={!canUpdate || pending === item.id} onChange={() => void toggle(item)} />
            <span className="task-checkmark"><i className="ri-check-line" /></span>
            <span>{item.label}</span>
            {pending === item.id && <i className="ri-loader-4-line task-checklist-spinner" />}
          </label>
        ))}
      </div>
      {!canUpdate && <small className="text-secondary">Only the assigned owner can update this checklist.</small>}
      {error && <div className="small text-danger mt-2" role="alert">{error}</div>}
    </section>
  );
}
