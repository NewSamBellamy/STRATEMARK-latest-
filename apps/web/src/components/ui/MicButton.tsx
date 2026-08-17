/**
 * Voice-input button — ChatGPT-style mic docked beside a text input.
 *
 * Uses the Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 * Gracefully disables itself (with a tooltip) in browsers that don't support
 * it, rather than failing silently or throwing.
 */
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/cn';

// Minimal shape of the Web Speech API we rely on — not in lib.dom.d.ts.
interface SpeechRecognitionResultLike {
  results: { [i: number]: { [j: number]: { transcript: string } } ; length: number };
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionResultLike) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function MicButton({
  onTranscript,
  className,
  disabled,
}: {
  onTranscript: (text: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const toggle = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (e) => {
      const transcript = e.results[e.results.length - 1]?.[0]?.transcript;
      if (transcript) onTranscript(transcript.trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || !supported}
      className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-content disabled:opacity-40',
        listening && 'bg-negative/10 text-negative',
        className,
      )}
      aria-label={supported ? (listening ? 'Stop voice input' : 'Start voice input') : 'Voice input not supported in this browser'}
      title={supported ? (listening ? 'Stop voice input' : 'Speak your question') : 'Voice input not supported in this browser'}
    >
      {supported ? (
        <Mic className={cn('h-4 w-4', listening && 'animate-pulse')} strokeWidth={1.8} />
      ) : (
        <MicOff className="h-4 w-4" strokeWidth={1.8} />
      )}
    </button>
  );
}
