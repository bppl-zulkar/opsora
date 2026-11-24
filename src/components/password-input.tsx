"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className = "form-control", ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={className}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide value" : "Show value"}
        aria-pressed={visible}
        title={visible ? "Hide" : "Show"}
      >
        <i
          className={visible ? "ri-eye-off-line" : "ri-eye-line"}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
