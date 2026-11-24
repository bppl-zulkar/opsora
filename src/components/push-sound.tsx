"use client";

import { useEffect } from "react";

export function PushSound() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("AudioContext" in window)) return;

    let audio: AudioContext | null = null;
    const unlock = () => {
      audio ??= new AudioContext();
      if (audio.state === "suspended") void audio.resume().catch(console.error);
    };
    const play = (event: MessageEvent) => {
      if (
        event.data?.type !== "OPSORA_PUSH_SOUND" ||
        document.visibilityState !== "visible" ||
        !("Notification" in window) ||
        Notification.permission !== "granted" ||
        !audio ||
        audio.state !== "running"
      )
        return;

      const start = audio.currentTime;
      for (const [index, frequency] of [740, 988].entries()) {
        const oscillator = audio.createOscillator();
        const volume = audio.createGain();
        const at = start + index * 0.16;
        oscillator.frequency.value = frequency;
        oscillator.type = "sine";
        volume.gain.setValueAtTime(0.0001, at);
        volume.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
        volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
        oscillator.connect(volume);
        volume.connect(audio.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.13);
      }
    };

    navigator.serviceWorker.addEventListener("message", play);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      navigator.serviceWorker.removeEventListener("message", play);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      if (audio) void audio.close().catch(console.error);
    };
  }, []);

  return null;
}
