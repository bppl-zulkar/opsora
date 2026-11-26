"use client";

import { useRouter } from "next/navigation";

export function ResponsiveTaskStatus({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string; href: string }[];
}) {
  const router = useRouter();

  return (
    <div className="responsive-task-status">
      <label htmlFor="responsive-task-status">Status</label>
      <select
        id="responsive-task-status"
        className="form-select"
        value={value}
        onChange={(event) => {
          const option = options.find(
            (item) => item.value === event.target.value,
          );
          if (option) router.push(option.href);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
