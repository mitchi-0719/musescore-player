import { useCallback, useEffect, useRef } from "react";
import { DRUM_MAP } from "../constants/drum";
import { PIANO_MAP } from "../constants/piano";
import type { NoteEvent } from "../lib/musicXmlParser";


export const midiToNoteName = (midi: number) => {
  const names = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
};

export const useAudioPlayer = (
  osmdInstance: any,
  parsedEvents: NoteEvent[],
) => {
  // anyを使ってTurbopackの干渉を完全に防ぐ
  const pianoSampler = useRef<any>(null);
  const drumSampler = useRef<any>(null);
  const toneRef = useRef<any>(null);

  const isPlaying = useRef(false);
  const startTime = useRef<number>(0);
  const scheduledEventIndices = useRef<Set<number>>(new Set());

  useEffect(() => {
    let isMounted = true;

    const initTone = async () => {
      try {
        // ここが以前機能していた「大正解」のコードです
        const mod = await import("tone");
        const Tone = (mod as any).default ?? mod;

        if (!isMounted) return;
        toneRef.current = Tone;

        pianoSampler.current = new Tone.Sampler({
          urls: PIANO_MAP as any,
          baseUrl: "/sounds/piano/",
        }).toDestination();

        drumSampler.current = new Tone.Sampler({
          urls: DRUM_MAP as any,
          baseUrl: "/sounds/drums/",
        }).toDestination();

        console.log("Tone.js and Samplers loaded successfully!");
      } catch (err) {
        console.error("Failed to initialize Tone.js:", err);
      }
    };

    initTone();

    return () => {
      isMounted = false;
      pianoSampler.current?.dispose();
      drumSampler.current?.dispose();
    };
  }, []);

  const play = useCallback(async () => {
    const Tone = toneRef.current;
    if (!Tone) return;

    // Contextの起動（以前の安全なロジック）
    if (typeof Tone.start === "function") {
      try {
        await Tone.start();
      } catch (e) {
        console.warn("Tone start failed:", e);
      }
    }

    isPlaying.current = true;
    startTime.current = Tone.now();
    scheduledEventIndices.current.clear();

    if (osmdInstance) {
      osmdInstance.cursor.show();
    }
  }, [osmdInstance]);

  const stop = useCallback(() => {
    isPlaying.current = false;
    pianoSampler.current?.releaseAll();
    drumSampler.current?.releaseAll();

    if (osmdInstance) {
      osmdInstance.cursor.hide();
    }
  }, [osmdInstance]);

  const playNote = useCallback(
    (midi: number, duration: string | number = "8n") => {
      const sampler = midi < 60 ? drumSampler.current : pianoSampler.current;
      sampler?.triggerAttackRelease(midiToNoteName(midi), duration);
    },
    [],
  );

  const seek = useCallback((time: number) => {
    if (!toneRef.current) return;
    startTime.current = toneRef.current.now() - time;
    scheduledEventIndices.current.clear();
  }, []);

  useEffect(() => {
    if (!isPlaying.current || !toneRef.current) return;

    let animationFrameId: number;
    const update = () => {
      if (!isPlaying.current || !toneRef.current) return;

      const elapsed = toneRef.current.now() - startTime.current;

      parsedEvents.forEach((ev, index) => {
        if (!scheduledEventIndices.current.has(index) && elapsed >= ev.time) {
          playNote(ev.midi, ev.duration);
          scheduledEventIndices.current.add(index);

          if (osmdInstance) {
            osmdInstance.cursor.next();
          }
        }
      });

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [parsedEvents, osmdInstance, playNote]);

  return { play, stop, seek, playNote };
};
