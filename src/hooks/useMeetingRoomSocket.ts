import { useEffect, useRef } from 'react';
import { issueRoomTicket, type LiveSummaryResponse, type TranscriptLineResponse } from '../api/meeting';
import { retryDelay, socketUrl } from '../meeting/socketUrl';

/** 회의방 WebSocket 메시지 (docs/services/meeting-service.md 4.3.2, meeting-service RoomMessage) */
export type RoomMessage =
  | { type: 'transcript' | 'transcriptEdited'; line: TranscriptLineResponse }
  | { type: 'transcriptDeleted'; seq: number; rev: number }
  | { type: 'paused' | 'resumed' | 'finished' }
  | { type: 'liveSummary'; liveSummary: LiveSummaryResponse }
  | { type: 'aiStatus'; available: boolean };

interface RoomSocketHandlers {
  onMessage: (message: RoomMessage) => void;
  /** 끊겼다 다시 붙었을 때. 끊긴 동안 놓친 내용을 API로 다시 받는다 */
  onReconnect: () => void;
}

/**
 * REQ-079, 083~085 회의방 WebSocket. 1회용 입장권을 받아 연결하고, 끊기면 새 입장권으로 다시 붙는다.
 * 회의가 끝나면(finished) 서버가 닫으므로 다시 붙지 않는다.
 */
export function useMeetingRoomSocket(meetingId: number | undefined, handlers: RoomSocketHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (meetingId === undefined) {
      return undefined;
    }
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let attempt = 0;
    let isClosed = false;
    let hasConnected = false;

    const scheduleRetry = () => {
      if (!isClosed) {
        retryTimer = window.setTimeout(connect, retryDelay(attempt));
        attempt += 1;
      }
    };

    async function connect() {
      let ticket: string;
      try {
        ticket = await issueRoomTicket(meetingId as number);
      } catch {
        scheduleRetry();
        return;
      }
      if (isClosed) {
        return;
      }
      socket = new WebSocket(socketUrl(`/ws/meetings/${meetingId}`, ticket));
      socket.onopen = () => {
        attempt = 0;
        if (hasConnected) {
          handlersRef.current.onReconnect();
        }
        hasConnected = true;
      };
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data as string) as RoomMessage;
        if (message.type === 'finished') {
          isClosed = true;
        }
        handlersRef.current.onMessage(message);
      };
      socket.onclose = scheduleRetry;
    }

    void connect();
    return () => {
      isClosed = true;
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [meetingId]);
}
