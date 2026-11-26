"use client";
import { useEffect } from "react";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function PushSubscriptionSync() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!("Notification" in window) || Notification.permission !== "granted")
      return;
    const synchronize = async () => {
      const response = await fetch("/api/push/configuration", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const configuration = await response.json();
      if (!configuration.enabled || !configuration.publicKey) return;
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(configuration.publicKey),
        }));
      await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
    };
    void synchronize().catch(() => undefined);
  }, []);
  return null;
}
