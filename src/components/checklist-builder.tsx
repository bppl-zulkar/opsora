"use client";

import { useState } from "react";

export function ChecklistBuilder() {
  const [items, setItems] = useState([""]);

  function update(index: number, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  function remove(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <section className="task-checklist-builder">
      <div className="task-checklist-heading">
        <div>
          <h2>Completion checklist <span>Optional</span></h2>
          <p>Add clear steps the assignee can tick as the work progresses.</p>
        </div>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setItems((current) => current.length < 30 ? [...current, ""] : current)} disabled={items.length >= 30}>
          <i className="ri-add-line" /> Add item
        </button>
      </div>
      <div className="task-checklist-inputs">
        {items.map((item, index) => (
          <div className="task-checklist-input" key={index}>
            <span>{index + 1}</span>
            <input name="checklist_item" className="form-control" value={item} onChange={(event) => update(index, event.target.value)} maxLength={240} placeholder="Example: Verify the monthly invoice totals" />
            <button type="button" onClick={() => remove(index)} aria-label={`Remove checklist item ${index + 1}`} disabled={items.length === 1 && !item}><i className="ri-delete-bin-line" /></button>
          </div>
        ))}
      </div>
      <small>Blank items are ignored. You can add up to 30 checklist steps.</small>
    </section>
  );
}
