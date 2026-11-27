"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const VoiceTaskAssistant = dynamic(
  () => import("./voice-task-assistant").then((module) => module.VoiceTaskAssistant),
  { ssr: false },
);

export function VoiceTaskAssistantLoader({ userName }: { userName: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const browserWindow = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (browserWindow.requestIdleCallback) {
      const handle = browserWindow.requestIdleCallback(() => setReady(true), { timeout: 1200 });
      return () => browserWindow.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(() => setReady(true), 350);
    return () => window.clearTimeout(handle);
  }, []);

  return ready ? <VoiceTaskAssistant userName={userName} /> : null;
}
