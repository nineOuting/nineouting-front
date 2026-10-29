import { issueSttTicket } from '../api/meeting';
import { retryDelay, socketUrl } from './socketUrl';

// stt-service 음성 형식 (nineouting-stt prototype/README.md "내보내는 형식")
const SAMPLE_RATE = 16000;
const CHUNK_MS = 100;
const CHUNK_SAMPLES = (SAMPLE_RATE * CHUNK_MS) / 1000;
const BYTES_PER_SAMPLE = 2;
const INT16_MAX = 0x7fff;
// 다른 연결이 자리를 이어받았다는 STT 종료 코드. 이때는 다시 붙지 않는다
const CLOSE_REPLACED = 4001;
// 끊긴 동안 모아 둘 음성 (10분). 넘으면 오래된 것부터 버린다
const MAX_BACKLOG_CHUNKS = 6000;
// 회의를 마무리할 때 STT의 ended 답을 기다리는 최대 시간
const END_WAIT_MS = 2000;

const WORKLET_NAME = 'nineouting-pcm';
const WORKLET_CODE = `class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    if (inputs[0][0]) this.port.postMessage(inputs[0][0].slice(0));
    return true;
  }
}
registerProcessor('${WORKLET_NAME}', PcmProcessor);`;

interface Chunk {
  offsetMs: number;
  data: ArrayBuffer;
}

function toPcm16(samples: Float32Array) {
  const buffer = new ArrayBuffer(samples.length * BYTES_PER_SAMPLE);
  const view = new DataView(buffer);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(index * BYTES_PER_SAMPLE, Math.round(clamped * INT16_MAX), true);
  });
  return buffer;
}

/** STT 답 중 {"type":"ended"} (end를 받았다는 답)인지 */
function isEnded(text: string) {
  try {
    return (JSON.parse(text) as { type?: unknown }).type === 'ended';
  } catch {
    return false;
  }
}

/**
 * REQ-079~080 회의록 작성자 브라우저의 마이크 소리를 stt-service로 보낸다.
 * 16kHz 모노 16비트 PCM을 100ms(3,200바이트)씩 보내고, 시작·멈춤·재개는 JSON으로 알린다.
 * 끊기면 소리를 모아 두었다가 새 입장권으로 다시 붙어 start(offsetMs)부터 몰아 보낸다 (REQ-082).
 */
export class SttStream {
  private readonly meetingId: number;
  private offsetMs: number;
  private isPaused = false;
  private isStopped = false;
  private isEnded = false;
  private ending: Promise<void> | null = null;
  private attempt = 0;
  private socket: WebSocket | null = null;
  private retryTimer: number | undefined;
  private media: MediaStream | null = null;
  private context: AudioContext | null = null;
  private pending = new Float32Array(0);
  private backlog: Chunk[] = [];

  /** @param offsetMs 회의 시작부터 지금까지의 음성 길이. 새로고침 뒤 다시 들어와도 시간축이 이어진다 */
  constructor(meetingId: number, offsetMs: number, isPaused: boolean) {
    this.meetingId = meetingId;
    this.offsetMs = offsetMs;
    this.isPaused = isPaused;
  }

  async start() {
    this.media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    // 16kHz 변환은 브라우저에 맡긴다 (표본을 직접 솎으면 음질이 나빠진다)
    this.context = new AudioContext({ sampleRate: SAMPLE_RATE });
    const workletUrl = URL.createObjectURL(new Blob([WORKLET_CODE], { type: 'text/javascript' }));
    await this.context.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);
    if (this.isStopped) {
      this.release();
      return;
    }
    const node = new AudioWorkletNode(this.context, WORKLET_NAME);
    node.port.onmessage = (event: MessageEvent<Float32Array>) => this.collect(event.data);
    this.context.createMediaStreamSource(this.media).connect(node);
    void this.connect();
  }

  pause() {
    this.isPaused = true;
    this.pending = new Float32Array(0);
    this.sendControl({ type: 'pause' });
  }

  resume() {
    this.isPaused = false;
    this.sendControl({ type: 'resume' });
  }

  /**
   * 회의를 마무리한 뒤(finishMeeting 성공 후). STT가 말하던 줄을 확정하고 남은 줄을 보낸 뒤 회의 종료(end)를 백엔드에 알린다.
   * ended 답을 받거나 END_WAIT_MS가 지나면 닫고 마이크를 끈다. 끊겨 있으면 end를 보내지 못하고 그냥 닫는다.
   * 여러 번 불러도 한 번만 보낸다 (마무리 직후 회의방의 finished로 화면을 떠나면서 또 부를 수 있다)
   */
  end() {
    this.ending ??= this.sendEnd();
    return this.ending;
  }

  private async sendEnd() {
    this.isEnded = true;
    window.clearTimeout(this.retryTimer);
    this.pending = new Float32Array(0);
    this.backlog = [];
    const socket = this.socket;
    this.socket = null;
    if (socket?.readyState === WebSocket.OPEN) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          window.clearTimeout(timer);
          socket.removeEventListener('message', onMessage);
          socket.removeEventListener('close', finish);
          resolve();
        };
        const onMessage = (event: MessageEvent) => {
          if (typeof event.data === 'string' && isEnded(event.data)) {
            finish();
          }
        };
        const timer = window.setTimeout(finish, END_WAIT_MS);
        socket.addEventListener('message', onMessage);
        socket.addEventListener('close', finish);
        socket.send(JSON.stringify({ type: 'end' }));
      });
    }
    socket?.close();
    this.release();
  }

  /** 화면을 떠날 때. 회의를 끝내는 것(end)과 달리 다시 들어오면 이어서 보낸다 */
  stop() {
    this.isStopped = true;
    window.clearTimeout(this.retryTimer);
    this.socket?.close();
    this.release();
  }

  private release() {
    this.media?.getTracks().forEach((track) => track.stop());
    void this.context?.close();
    this.media = null;
    this.context = null;
  }

  private collect(samples: Float32Array) {
    if (this.isPaused || this.isStopped || this.isEnded) {
      return;
    }
    const merged = new Float32Array(this.pending.length + samples.length);
    merged.set(this.pending);
    merged.set(samples, this.pending.length);
    let start = 0;
    while (merged.length - start >= CHUNK_SAMPLES) {
      this.sendChunk({ offsetMs: this.offsetMs, data: toPcm16(merged.subarray(start, start + CHUNK_SAMPLES)) });
      this.offsetMs += CHUNK_MS;
      start += CHUNK_SAMPLES;
    }
    this.pending = merged.slice(start);
  }

  private sendChunk(chunk: Chunk) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(chunk.data);
      return;
    }
    this.backlog.push(chunk);
    if (this.backlog.length > MAX_BACKLOG_CHUNKS) {
      this.backlog.shift();
    }
  }

  private sendControl(message: object) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private async connect() {
    let ticket: string;
    try {
      ticket = await issueSttTicket(this.meetingId);
    } catch {
      this.scheduleRetry();
      return;
    }
    if (this.isStopped || this.isEnded) {
      return;
    }
    const socket = new WebSocket(socketUrl(`/ws/stt/meetings/${this.meetingId}`, ticket));
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => {
      this.attempt = 0;
      const offsetMs = this.backlog[0]?.offsetMs ?? this.offsetMs;
      socket.send(JSON.stringify({ type: 'start', meetingId: String(this.meetingId), offsetMs }));
      // 끊긴 동안 누른 멈춤·재개는 보내지 못했으므로 지금 상태를 다시 알린다 (STT는 같은 상태면 무시한다).
      // 재개는 모아 둔 소리보다 먼저(멈춘 STT는 소리를 버린다), 멈춤은 나중에(멈추기 전 소리를 살린다)
      if (!this.isPaused) {
        socket.send(JSON.stringify({ type: 'resume' }));
      }
      this.backlog.forEach(({ data }) => socket.send(data));
      this.backlog = [];
      if (this.isPaused) {
        socket.send(JSON.stringify({ type: 'pause' }));
      }
    };
    socket.onclose = (event) => {
      // 마무리(end)로 닫은 연결이나 이미 바뀐 연결은 다시 붙지 않는다
      if (socket === this.socket && event.code !== CLOSE_REPLACED) {
        this.scheduleRetry();
      }
    };
    this.socket = socket;
  }

  private scheduleRetry() {
    if (!this.isStopped && !this.isEnded) {
      this.retryTimer = window.setTimeout(() => void this.connect(), retryDelay(this.attempt));
      this.attempt += 1;
    }
  }
}
