"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_BASE } from "@lib/api/client";
import type { NetplaySession } from "./types";

type SignalAck = { status: "ok"; id: string } | { status: "error"; message?: string };

type SignalMessage = {
  id: string;
  sessionId: string;
  type: string;
  payload: unknown;
  sender: { userId: string; participantId: string };
  recipient?: { userId: string; participantId: string };
  createdAt: string;
};

type UseNetplaySignalOptions = {
  sessionId?: string | null;
  peerToken?: string | null;
  accessToken?: string | null;
  onSessionUpdate?: (session: NetplaySession) => void;
  onPeerToken?: (sessionId: string, token: string) => void;
  onSessionClosed?: (payload: { sessionId: string; reason: "closed" | "expired" | "not_found" }) => void;
  onMessage?: (message: SignalMessage) => void;
  onLatency?: (latencyMs: number) => void;
};

type EmitPayload = {
  type: string;
  payload?: unknown;
  targetUserId?: string;
};

type UseNetplaySignalResult = {
  connected: boolean;
  latency: number | null;
  sendSignal: (payload: EmitPayload) => Promise<SignalAck>;
  close: () => void;
};

export function useNetplaySignal(options: UseNetplaySignalOptions): UseNetplaySignalResult {
  const { sessionId, peerToken, accessToken } = options;
  const { onSessionUpdate, onPeerToken, onSessionClosed, onMessage, onLatency } = options;
  const socketRef = useRef<Socket | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  const teardownSocket = useCallback(() => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setConnected(false);
  }, []);

  useEffect(() => {
    if (!sessionId || !peerToken || !accessToken) {
      return () => {
        teardownSocket();
      };
    }

    if (typeof window === "undefined") {
      return () => {
        teardownSocket();
      };
    }

    const socket = io(API_BASE, {
      path: "/netplay/signal",
      transports: ["websocket"],
      auth: {
        token: accessToken,
        sessionId,
        peerToken,
      },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("session:snapshot", (payload: { session: NetplaySession; peerToken: string }) => {
      onSessionUpdate?.(payload.session);
      onPeerToken?.(payload.session.id, payload.peerToken);
    });

    socket.on("session:update", (payload: { session: NetplaySession }) => {
      onSessionUpdate?.(payload.session);
    });

    socket.on(
      "session:closed",
      (payload: { sessionId: string; reason: "closed" | "expired" | "not_found" }) => {
        onSessionClosed?.(payload);
        teardownSocket();
      },
    );

    socket.on("peer:token", (payload: { sessionId: string; peerToken: string }) => {
      onPeerToken?.(payload.sessionId, payload.peerToken);
    });

    socket.on("signal:message", (message: SignalMessage) => {
      onMessage?.(message);
    });

    const scheduleLatencyProbe = () => {
      if (pingTimer.current) {
        clearInterval(pingTimer.current);
      }

      if (!socket.connected) {
        return;
      }

      pingTimer.current = setInterval(() => {
        const startedAt = performance.now();
        socket.timeout(5000).emit("latency:ping", (response?: { receivedAt: number }) => {
          const duration = performance.now() - startedAt;
          setLatency(duration);
          onLatency?.(duration);
        });
      }, 15_000);
    };

    socket.on("connect", scheduleLatencyProbe);
    if (socket.connected) {
      scheduleLatencyProbe();
    }

    return () => {
      teardownSocket();
    };
  }, [
    accessToken,
    peerToken,
    sessionId,
    onLatency,
    onMessage,
    onPeerToken,
    onSessionClosed,
    onSessionUpdate,
    teardownSocket,
  ]);

  const sendSignal = useCallback(
    (payload: EmitPayload): Promise<SignalAck> => {
      const socket = socketRef.current;
      if (!socket) {
        return Promise.reject(new Error("Signal channel is not connected"));
      }

      return new Promise<SignalAck>((resolve, reject) => {
        socket.timeout(5000).emit("signal:message", payload, (ack?: SignalAck) => {
          if (!ack) {
            reject(new Error("Signal acknowledgement missing"));
            return;
          }

          if (ack.status !== "ok") {
            reject(new Error(ack.message ?? "Signal rejected"));
            return;
          }

          resolve(ack);
        });
      });
    },
    [],
  );

  const close = useCallback(() => {
    teardownSocket();
  }, [teardownSocket]);

  return useMemo(
    () => ({
      connected,
      latency,
      sendSignal,
      close,
    }),
    [close, connected, latency, sendSignal],
  );
}

export type { SignalMessage };
