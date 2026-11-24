"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type PermissionState = "pending" | "granted" | "denied" | "unsupported";
type PermissionKey = "notifications" | "location" | "camera";

const labels: Record<
  PermissionKey,
  { icon: string; title: string; text: string }
> = {
  notifications: {
    icon: "ri-notification-3-line",
    title: "Notifications",
    text: "Receive task updates. On iOS 16.4+, install Opsora to your Home Screen first. Sound follows device settings.",
  },
  location: {
    icon: "ri-map-pin-line",
    title: "Location",
    text: "Attach verified location information where a workflow requires it.",
  },
  camera: {
    icon: "ri-camera-line",
    title: "Camera",
    text: "Capture task evidence and profile photographs from this device.",
  },
};

const initial: Record<PermissionKey, PermissionState> = {
  notifications: "pending",
  location: "pending",
  camera: "pending",
};

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function PermissionGate() {
  const [open, setOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [states, setStates] = useState(initial);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (localStorage.getItem("opsora-permissions-onboarded") !== "yes")
        setOpen(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  async function enable() {
    setRequesting(true);
    setAttempted(true);
    const next = { ...states };

    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      next.notifications = result === "granted" ? "granted" : "denied";
      if (result === "granted" && "serviceWorker" in navigator) {
        try {
          const configuration = await fetch("/api/push/configuration").then(
            (response) => response.json(),
          );
          if (configuration.enabled && configuration.publicKey) {
            const registration = await navigator.serviceWorker.ready;
            const existing = await registration.pushManager.getSubscription();
            const subscription =
              existing ??
              (await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey(
                  configuration.publicKey,
                ),
              }));
            await fetch("/api/push/subscriptions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(subscription),
            });
          }
        } catch {
          next.notifications = "denied";
        }
      }
    } else next.notifications = "unsupported";

    if ("geolocation" in navigator) {
      next.location = await new Promise<PermissionState>((resolve) =>
        navigator.geolocation.getCurrentPosition(
          () => resolve("granted"),
          () => resolve("denied"),
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 },
        ),
      );
    } else next.location = "unsupported";

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        stream.getTracks().forEach((track) => track.stop());
        next.camera = "granted";
      } catch {
        next.camera = "denied";
      }
    } else next.camera = "unsupported";

    setStates(next);
    setRequesting(false);
    if (
      Object.values(next).every(
        (value) => value === "granted" || value === "unsupported",
      )
    ) {
      localStorage.setItem("opsora-permissions-onboarded", "yes");
      setOpen(false);
    }
  }

  function continueLimited() {
    localStorage.setItem("opsora-permissions-onboarded", "yes");
    setOpen(false);
  }

  if (!open) return null;
  return (
    <div
      className="permission-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="permission-title"
    >
      <div className="permission-card">
        <Image
          src="/opsora-logo.png"
          alt="Opsora"
          className="permission-logo"
          width={190}
          height={62}
        />
        <h1 id="permission-title">Set up device access</h1>
        <p className="text-secondary">
          Opsora uses these device features to complete task workflows. Your
          browser will ask you to approve each one.
        </p>
        <div className="permission-list">
          {(Object.keys(labels) as PermissionKey[]).map((key) => (
            <div className="permission-item" key={key}>
              <i className={labels[key].icon} />
              <span>
                <strong>{labels[key].title}</strong>
                <small>{labels[key].text}</small>
              </span>
              <em className={`permission-state ${states[key]}`}>
                {states[key]}
              </em>
            </div>
          ))}
          <div className="permission-item">
            <i className="ri-folder-image-line" />
            <span>
              <strong>Photos and files</strong>
              <small>
                Choose evidence from the gallery or file picker when attaching
                it to a task.
              </small>
            </span>
            <em className="permission-state granted">on selection</em>
          </div>
        </div>
        <button
          className="btn btn-primary btn-lg w-100"
          onClick={enable}
          disabled={requesting}
        >
          {requesting
            ? "Waiting for device permissions…"
            : attempted
              ? "Try permissions again"
              : "Allow device access"}
        </button>
        {attempted &&
          Object.values(states).some((value) => value === "denied") && (
            <div className="permission-help">
              A permission was declined. Enable it in this site’s browser
              settings and try again.
              <button type="button" onClick={continueLimited}>
                Continue with limited access
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
