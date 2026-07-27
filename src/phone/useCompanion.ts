/**
 * The conversation phone: a WebRTC session against the Realtime API.
 *
 * Connection flow, per OpenAI's current WebRTC guide:
 *   1. Mint an ephemeral client secret from POST /v1/realtime/client_secrets.
 *      Normally a backend does this; here the app is its own backend, since the
 *      key already lives on the machine.
 *   2. Create an RTCPeerConnection, attach the microphone, offer.
 *   3. POST the offer SDP to /v1/realtime/calls, apply the answer.
 *   4. Configure turn detection over the data channel once it opens.
 *
 * Turn detection is semantic rather than silence-timed. A plain VAD cuts a turn
 * after N milliseconds of quiet, which is wrong for someone 90 who pauses
 * mid-sentence to think -- she would be interrupted constantly. Semantic VAD
 * judges from the words whether she has actually finished, and "low" eagerness
 * gives her the most room.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { CONTENT } from "../content/loadContent";
import { japanDate, japanDateLabel } from "../news/newsCache";
import { useSettings } from "../state/settings";
import { useStore } from "../state/store";
import { buildInstructions } from "./companionPrompt";
import {
  appendNote,
  clearMemory,
  formatMemory,
  readMemory,
  type MemoryNote,
} from "./companionMemory";

const OPENAI_BASE = "https://api.openai.com/v1";

export type PhoneStatus = "idle" | "connecting" | "connected" | "error";

export interface CompanionState {
  status: PhoneStatus;
  lastError: string | null;
  available: boolean;
  memory: MemoryNote[];
  forgetEverything: () => void;
}

/** Plain fetch: the SDP exchange and token mint are ordinary HTTPS requests. */
async function http(input: string, init?: RequestInit): Promise<Response> {
  try {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return await tauriFetch(input, init);
  } catch {
    return await globalThis.fetch(input, init);
  }
}

export function useCompanion(): CompanionState {
  const phoneStatus = useStore((s) => s.phoneStatus);
  const setPhoneStatus = useStore((s) => s.setPhoneStatus);
  const endCall = useStore((s) => s.endCall);

  const apiKey = useSettings((s) => s.openAiApiKey);
  const companionEnabled = useSettings((s) => s.companionEnabled);

  const [lastError, setLastError] = useState<string | null>(null);
  const [memory, setMemory] = useState<MemoryNote[]>(() => readMemory());

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  /** Plain-text transcript of the call, used only to write the closing note. */
  const transcriptRef = useRef<string[]>([]);

  const config = CONTENT.companion;
  const available = config.enabled && companionEnabled && Boolean(apiKey.trim());

  const teardown = useCallback(() => {
    channelRef.current?.close();
    channelRef.current = null;

    pcRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;

    // Releasing the tracks is what turns off the macOS microphone indicator.
    // Leaving it lit after she hangs up would be alarming and rightly so.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
  }, []);

  /** Summarises the call into a couple of lines for the next one to build on. */
  const writeClosingNote = useCallback(async () => {
    const transcript = transcriptRef.current.join("\n").trim();
    transcriptRef.current = [];
    if (!config.memoryEnabled || transcript.length < 80) return;

    const key = useSettings.getState().openAiApiKey.trim();
    if (!key) return;

    try {
      const response = await http(`${OPENAI_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: config.memoryModel,
          temperature: 0.2,
          max_tokens: 220,
          messages: [
            {
              role: "user",
              content: [
                "次の会話から、次に話すときに覚えておくとよいことを、",
                "日本語で二つか三つ、短い箇条書きにしてください。",
                "・本人が話したことだけを書くこと。推測を書かないこと。",
                "・体調や病気のことは書かないこと。",
                "・記号や前置きは不要。箇条書きの中身だけを出してください。",
                "",
                transcript.slice(-6000),
              ].join("\n"),
            },
          ],
        }),
      });
      if (!response.ok) return;

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) return;

      setMemory(appendNote({ date: japanDate(), text }, config.maxMemoryNotes));
    } catch {
      // A missing note is not worth surfacing; the next call simply has less.
    }
  }, [config]);

  const connect = useCallback(async () => {
    const key = useSettings.getState().openAiApiKey.trim();
    if (!key) {
      setLastError("APIキーが設定されていません");
      setPhoneStatus("error");
      return;
    }

    setLastError(null);
    transcriptRef.current = [];

    try {
      const instructions = buildInstructions(config, {
        memory: config.memoryEnabled ? formatMemory(readMemory()) : "",
        dateLabel: japanDateLabel(japanDate()),
      });

      // 1. Ephemeral client secret.
      const secretResponse = await http(`${OPENAI_BASE}/realtime/client_secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: config.model,
            instructions,
            audio: {
              output: { voice: config.voice },
              input: {
                turn_detection: { type: "semantic_vad", eagerness: config.eagerness },
              },
            },
          },
        }),
      });
      if (!secretResponse.ok) {
        throw new Error(
          `client_secrets ${secretResponse.status} ${(await secretResponse.text()).slice(0, 200)}`,
        );
      }
      const secret = (await secretResponse.json()) as { value?: string };
      if (!secret.value) throw new Error("no ephemeral key in the response");

      // 2. Microphone. This is what triggers the macOS permission prompt the
      //    very first time -- it must be accepted during setup, not by her.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ontrack = (event) => {
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0];
          void audioRef.current.play().catch(() => undefined);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setPhoneStatus("connected");
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setLastError(`connection ${pc.connectionState}`);
          endCall();
        }
      };

      for (const track of stream.getTracks()) pc.addTrack(track, stream);

      const channel = pc.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as {
            type?: string;
            transcript?: string;
          };
          // Both sides' transcripts are collected purely to write the closing
          // note. Nothing is stored until that summary is made.
          if (
            message.type === "conversation.item.input_audio_transcription.completed" &&
            message.transcript
          ) {
            transcriptRef.current.push(`本人: ${message.transcript}`);
          }
          if (message.type === "response.output_audio_transcript.done" && message.transcript) {
            transcriptRef.current.push(`相手: ${message.transcript}`);
          }
        } catch {
          // Not every event is JSON we care about.
        }
      };

      // 3. SDP offer / answer.
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const callResponse = await http(`${OPENAI_BASE}/realtime/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp", Authorization: `Bearer ${secret.value}` },
        body: offer.sdp ?? "",
      });
      if (!callResponse.ok) {
        throw new Error(`realtime/calls ${callResponse.status}`);
      }

      await pc.setRemoteDescription({ type: "answer", sdp: await callResponse.text() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // getUserMedia rejects with NotAllowedError when microphone access was
      // refused. Worth naming, because the fix is in System Settings.
      setLastError(
        message.includes("NotAllowed") || message.includes("Permission")
          ? `microphone permission denied — grant it in System Settings › Privacy & Security › Microphone (${message})`
          : message,
      );
      teardown();
      setPhoneStatus("error");
    }
  }, [config, endCall, setPhoneStatus, teardown]);

  // One audio element for the far end, mirroring the radio and news.
  useEffect(() => {
    const audio = new Audio();
    audio.autoplay = true;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.srcObject = null;
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (phoneStatus === "connecting" && !pcRef.current) {
      void connect();
      return;
    }
    if (phoneStatus === "idle" && pcRef.current) {
      teardown();
      void writeClosingNote();
    }
    if (phoneStatus === "error" && pcRef.current) {
      teardown();
    }
  }, [phoneStatus, connect, teardown, writeClosingNote]);

  // Nothing may outlive the app: a live microphone is not something to leak.
  useEffect(() => () => teardown(), [teardown]);

  const forgetEverything = useCallback(() => {
    clearMemory();
    setMemory([]);
  }, []);

  return { status: phoneStatus, lastError, available, memory, forgetEverything };
}
