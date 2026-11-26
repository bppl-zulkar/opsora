"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

type TaskResult = {
  id: string; reference: string; title: string; description?: string | null;
  status: string; priority: string; progress: number; deadline: string;
  createdAt: string; creator: string; owner: string;
  latestUpdate?: { status: string; remarks?: string | null; createdAt: string; actor: string } | null;
};
type ChatMessage = { role: "user" | "assistant"; text: string; results?: TaskResult[] };
type SpeechRecognitionResultLike = { 0: { transcript: string }; isFinal?: boolean };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike>; resultIndex?: number };
type SpeechRecognitionErrorLike = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const welcome: ChatMessage = {
  role: "assistant",
  text: "Hello. I’m your Opsora assistant. Ask me about your tasks, or say “Hey Opsora” before your question.",
};

export function VoiceTaskAssistant() {
  const [open, setOpen] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [awaitingWakeWord, setAwaitingWakeWord] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceModeRef = useRef(false);
  const wakeWordModeRef = useRef(false);
  const busyRef = useRef(false);
  const messagesRef = useRef(messages);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesRef.current = messages; endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, liveTranscript]);
  useEffect(() => () => {
    voiceModeRef.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  function speak(text: string) {
    if (!("speechSynthesis" in window)) {
      setMessages((current) => [...current, { role: "assistant", text: "Audio replies are not available in this browser, but you can read my written reply above." }]);
      return false;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    setSpeaking(false);
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferredNames = ["Samantha", "Jenny", "Aria", "Ava", "Zira", "Susan", "Victoria", "Google US English"];
    const voice = preferredNames.map((name) => voices.find((item) => item.lang.startsWith("en-US") && item.name.includes(name))).find(Boolean)
      ?? voices.find((item) => item.lang.startsWith("en-US"));
    if (voice) utterance.voice = voice;
    utterance.lang = "en-US";
    utterance.rate = .96;
    utterance.pitch = 1.08;
    utterance.volume = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => {
      setSpeaking(false);
      if (voiceModeRef.current) startListening();
    };
    utterance.onerror = (event) => {
      setSpeaking(false);
      if (!voiceModeRef.current || event.error === "canceled" || event.error === "interrupted") return;
      setMessages((current) => [...current, { role: "assistant", text: "I couldn’t play the audio reply. The written answer is still available above." }]);
      window.setTimeout(() => startListening(), 250);
    };
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "I couldn’t play the audio reply. The written answer is still available above." }]);
      return false;
    }
    return true;
  }

  async function ask(question: string, spokenText = question) {
    const clean = question.trim();
    if (!clean || busyRef.current) return;
    recognitionRef.current?.stop();
    setListening(false);
    setLiveTranscript("");
    const history = messagesRef.current.slice(-8);
    let answerToSpeak = "";
    setMessages((current) => [...current, { role: "user", text: spokenText.trim() }]);
    setInput("");
    busyRef.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, history }),
      });
      const data = (await response.json()) as { answer?: string; error?: string; results?: TaskResult[] };
      const answer = data.answer ?? data.error ?? "I could not answer that right now.";
      answerToSpeak = answer;
      setMessages((current) => [...current, { role: "assistant", text: answer, results: data.results }]);
    } catch {
      answerToSpeak = "I lost the connection. Please try again.";
      setMessages((current) => [...current, { role: "assistant", text: answerToSpeak }]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    if (voiceModeRef.current && !speak(answerToSpeak)) startListening();
  }

  function startListening() {
    if (busyRef.current || !voiceModeRef.current) return;
    setLiveTranscript("");
    const browserWindow = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setMessages((current) => [...current, { role: "assistant", text: "Voice recognition is not available in this browser. You can still type your question." }]);
      voiceModeRef.current = false;
      wakeWordModeRef.current = false;
      setAwaitingWakeWord(false);
      return;
    }
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    let latestTranscript = "";
    let transcriptHandled = false;
    const handleTranscript = (transcript: string) => {
      const cleanTranscript = transcript.trim();
      if (!cleanTranscript) return;
      setLiveTranscript("");
      setListening(false);
      if (wakeWordModeRef.current) {
        wakeWordModeRef.current = false;
        setAwaitingWakeWord(false);
        const wakeMatch = cleanTranscript.match(/^(?:(?:hey|hi)[\s,]+)?opsora\b[\s,.:;!?-]*(.*)$/i);
        const question = wakeMatch ? wakeMatch[1].trim() : cleanTranscript;
        if (!question) {
          const answer = "I’m here. Ask me about your open, overdue, completed, or assigned tasks.";
          setMessages((current) => [...current, { role: "user", text: cleanTranscript }, { role: "assistant", text: answer }]);
          if (voiceModeRef.current && !speak(answer)) startListening();
          return;
        }
        void ask(question, cleanTranscript);
        return;
      }
      void ask(cleanTranscript);
    };
    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      const startIndex = event.resultIndex ?? 0;
      for (let index = startIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        if (result.isFinal === false) interim = text;
        else final = text;
      }
      if (final && !transcriptHandled) {
        latestTranscript = final;
        transcriptHandled = true;
        handleTranscript(final);
      } else if (interim) {
        latestTranscript = interim;
        setLiveTranscript(interim);
      }
    };
    recognition.onend = () => {
      setListening(false);
      if (!transcriptHandled && latestTranscript && voiceModeRef.current) {
        transcriptHandled = true;
        handleTranscript(latestTranscript);
      }
      if (voiceModeRef.current && !busyRef.current && !window.speechSynthesis?.speaking) {
        window.setTimeout(() => startListening(), 250);
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "aborted") return;
      if (event.error === "no-speech") return;
      voiceModeRef.current = false;
      wakeWordModeRef.current = false;
      setAwaitingWakeWord(false);
      const message = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone access is blocked. Allow microphone access in your browser’s site settings, then start Live commands again."
        : event.error === "audio-capture"
          ? "I couldn’t access a microphone. Connect or enable a microphone, then try again."
          : `Voice recognition stopped (${event.error}). Please try the microphone again or type your question.`;
      setMessages((current) => [...current, { role: "assistant", text: message }]);
    };
    recognitionRef.current = recognition;
    setListening(true);
    try { recognition.start(); } catch {
      setListening(false);
      voiceModeRef.current = false;
      wakeWordModeRef.current = false;
      setAwaitingWakeWord(false);
      setMessages((current) => [...current, { role: "assistant", text: "I couldn’t start voice recognition. Please try again or type your question." }]);
    }
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      voiceModeRef.current = false;
      wakeWordModeRef.current = false;
      setAwaitingWakeWord(false);
      setLiveTranscript("");
      return;
    }
    voiceModeRef.current = true;
    wakeWordModeRef.current = fullScreen;
    setAwaitingWakeWord(fullScreen);
    window.speechSynthesis?.resume();
    startListening();
  }

  function openLiveCommands() {
    setOpen(true);
    setFullScreen(true);
    voiceModeRef.current = true;
    wakeWordModeRef.current = true;
    setAwaitingWakeWord(true);
    window.speechSynthesis?.resume();
    startListening();
  }

  function closeAssistant() {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    voiceModeRef.current = false;
    wakeWordModeRef.current = false;
    setListening(false);
    setAwaitingWakeWord(false);
    setLiveTranscript("");
    setFullScreen(false);
    setSpeaking(false);
    setOpen(false);
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(input); }

  return (
    <div className={`voice-assistant${open ? " is-open" : ""}${fullScreen ? " is-fullscreen" : ""}`}>
      {open && (
        <section className="voice-assistant-panel" aria-label="Opsora voice assistant">
          <header>
            <div className={`jarvis-orb${listening ? " is-listening" : ""}${speaking ? " is-speaking" : ""}`}><span /></div>
            <div><strong>Opsora Assistant</strong><small>{speaking ? "Speaking response…" : listening ? awaitingWakeWord ? "Say “Hey Opsora” or ask a question…" : "Listening in English…" : busy ? "Checking live tasks…" : "Online · Task aware"}</small></div>
            <button type="button" onClick={() => setFullScreen((value) => !value)} aria-label={fullScreen ? "Exit full screen" : "Open full screen"}><i className={fullScreen ? "ri-contract-left-right-line" : "ri-expand-left-right-line"} /></button>
            <button type="button" onClick={closeAssistant} aria-label="Close assistant"><i className="ri-close-line" /></button>
          </header>
          <div className="voice-assistant-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`assistant-response ${message.role}`} key={`${message.role}-${index}`}>
                <div className={`assistant-message ${message.role}`}>
                  {message.text}
                  {message.role === "assistant" && (
                    <button type="button" className="assistant-replay" onClick={() => speak(message.text)} aria-label="Play this reply aloud">
                      <i className="ri-volume-up-line" /> Listen
                    </button>
                  )}
                </div>
                {message.results?.length ? (
                  <div className="assistant-task-results">
                    {message.results.map((task) => (
                      <article className="assistant-task-card" key={task.id}>
                        <div className="assistant-task-topline">
                          <Link href={`/tasks/${task.id}`} onClick={() => setOpen(false)}>{task.reference}</Link>
                          <span className={`assistant-priority priority-${task.priority}`}>{task.priority}</span>
                        </div>
                        <h3>{task.title}</h3>
                        {task.description && <p>{task.description}</p>}
                        <div className="assistant-task-meta">
                          <span><i className="ri-user-add-line" /> Created by <strong>{task.creator}</strong></span>
                          <span><i className="ri-user-follow-line" /> Owner <strong>{task.owner}</strong></span>
                          <span><i className="ri-calendar-line" /> Due <strong>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(task.deadline))}</strong></span>
                          <span><i className="ri-checkbox-circle-line" /> <strong>{task.status}</strong></span>
                        </div>
                        <div className="assistant-task-progress"><span><b style={{ width: `${Math.max(0, Math.min(100, task.progress ?? 0))}%` }} /></span><small>{task.progress ?? 0}%</small></div>
                        {task.latestUpdate && (
                          <div className="assistant-latest-update">
                            <span>Latest update</span>
                            <strong>{task.latestUpdate.status}</strong>
                            <p>{task.latestUpdate.remarks || `Updated by ${task.latestUpdate.actor}`}</p>
                            <small>{task.latestUpdate.actor} · {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(task.latestUpdate.createdAt))}</small>
                          </div>
                        )}
                        <Link className="assistant-task-open" href={`/tasks/${task.id}`} onClick={() => setOpen(false)}>View complete task <i className="ri-arrow-right-line" /></Link>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {liveTranscript && (
              <div className="assistant-response user" aria-live="off">
                <div className="assistant-message user">{liveTranscript}</div>
              </div>
            )}
            {busy && <div className="assistant-message assistant typing"><span /><span /><span /></div>}
            <div ref={endRef} />
          </div>
          <div className="assistant-suggestions">
            {["My open tasks", "What is overdue?", "Tasks completed by me"].map((prompt) => <button type="button" onClick={() => void ask(prompt)} disabled={busy} key={prompt}>{prompt}</button>)}
          </div>
          <form onSubmit={submit} className="voice-assistant-input">
            <button type="button" className={listening ? "is-listening" : ""} onClick={toggleVoice} aria-label={listening ? "Stop listening" : "Ask with microphone"}><i className={listening ? "ri-stop-circle-line" : "ri-mic-line"} /></button>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about tasks in English…" aria-label="Message assistant" />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send message"><i className="ri-send-plane-2-fill" /></button>
          </form>
          <small className="assistant-privacy"><i className="ri-shield-check-line" /> Answers follow your existing task permissions</small>
        </section>
      )}
      {!open && (
        <div className="voice-assistant-actions">
          <button type="button" className="live-command-launcher" onClick={openLiveCommands} aria-label="Open live voice commands">
            <i className="ri-voiceprint-line" /><span>Live commands</span>
          </button>
          <button type="button" className="voice-assistant-launcher" onClick={() => setOpen(true)} aria-label="Open Opsora assistant" aria-expanded={open}>
            <span className="launcher-ring" />
            <i className="ri-sparkling-2-fill" />
            <span className="launcher-label">Ask Opsora</span>
          </button>
        </div>
      )}
    </div>
  );
}
