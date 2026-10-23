import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import {
  addMeetingAgenda,
  editTranscript,
  getLiveSummary,
  getMeetingDetail,
  listTranscripts,
  pauseMeeting,
  resumeMeeting,
  type MeetingDetailResponse,
} from '../../api/meeting';
import { getMe } from '../../api/user';
import dotNotDiscussed from '../../assets/dot-not-discussed.svg';
import dotRecording from '../../assets/dot-recording.svg';
import AppLayout from '../../components/AppLayout';
import Placeholder from '../../components/Placeholder';
import Toast, { type ToastMessage } from '../../components/Toast';
import { useMeetingRoomSocket, type RoomMessage } from '../../hooks/useMeetingRoomSocket';
import { SttStream } from '../../meeting/SttStream';
import { ROOM_SUGGESTION } from '../../mocks/meetingRoom';
import type { LiveSummary, RoomAgenda, TranscriptLine } from '../../types/meetingRoom';
import AddAgendaModal from './room/AddAgendaModal';
import AgendaStatusCard from './room/AgendaStatusCard';
import EvidencePanel from './room/EvidencePanel';
import LiveSummaryCard from './room/LiveSummaryCard';
import { AgendaSuggestion, OffTopicNotice } from './room/RoomNotices';
import {
  elapsedSecondsOf,
  mergeTranscript,
  removeTranscript,
  toLiveSummary,
  toRoomAgenda,
  toTranscriptLine,
} from './room/roomData';
import TranscriptPanel from './room/TranscriptPanel';
import styles from './MeetingRoomPage.module.css';

const BUTTON_ICON_SIZE = 16;
const DOT_SIZE = 8;
const TICK_MS = 1000;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const END_PENDING_MESSAGE = '회의 종료 화면은 디자인이 나오면 연결돼요.';
const MIC_FAILED_MESSAGE = '마이크를 쓸 수 없어 녹음하지 못하고 있어요. 브라우저의 마이크 권한을 확인해 주세요.';

/**
 * 새 안건 제안·주제 이탈 알림은 ai-service 안건 보드(2차) 이벤트가 아직 없어 주소로 띄워 본다.
 * ?demo=suggestion(새 안건 제안), ?demo=offtopic(주제 이탈 알림)
 */
type DemoScenario = 'suggestion' | 'offtopic' | null;

/** 00:24:18 */
function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

/** REQ-079~093, 124~126 회의 진행 화면 */
export default function MeetingRoomPage() {
  const navigate = useNavigate();
  const { meetingId } = useParams();
  const [searchParams] = useSearchParams();
  const demo = searchParams.get('demo') as DemoScenario;

  const [detail, setDetail] = useState<MeetingDetailResponse | null>(null);
  const [isWriter, setIsWriter] = useState(false);
  const [agendas, setAgendas] = useState<RoomAgenda[]>([]);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [summary, setSummary] = useState<LiveSummary | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isAiAvailable, setIsAiAvailable] = useState(true);
  const [selectedAgendaId, setSelectedAgendaId] = useState('');
  const [selectedDecisionId, setSelectedDecisionId] = useState<string>();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(demo === 'suggestion');
  const [isOffTopicOpen, setIsOffTopicOpen] = useState(demo === 'offtopic');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeSuggestion = useCallback(() => setIsSuggestionOpen(false), []);
  const sttRef = useRef<SttStream | null>(null);
  // STT 연결을 새로 열 때 이어 보낼 음성 위치·멈춤 상태 (바뀔 때마다 다시 열지 않도록 ref로 읽는다)
  const elapsedRef = useRef(0);
  const isPausedRef = useRef(false);
  const startedAt = detail?.startedAt ?? null;
  const numericMeetingId = detail?.meetingId;
  const isLive = detail?.status === 'IN_PROGRESS' && !isFinished;

  const showError = useCallback((error: unknown) => setToast({ text: errorMessage(error), variant: 'error' }), []);

  /** 처음 들어올 때와 회의방 연결이 끊겼다 다시 붙을 때 지금 상태를 다시 받는다 */
  const reloadLive = useCallback(
    async (id: number, started: string | null) => {
      const [lines, live] = await Promise.all([listTranscripts(id), getLiveSummary(id)]);
      setTranscript(lines.map((line) => toTranscriptLine(line, started)).sort((a, b) => a.startMs - b.startMs));
      setSummary(toLiveSummary(live));
    },
    [],
  );

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      const [loaded, me] = await Promise.all([getMeetingDetail(meetingId ?? ''), getMe()]);
      if (!isCurrent) {
        return;
      }
      if (loaded.status === 'SCHEDULED') {
        navigate(`/meetings/${loaded.meetingId}`, { replace: true });
        return;
      }
      const roomAgendas = loaded.agendas.map(toRoomAgenda);
      setDetail(loaded);
      setIsWriter(loaded.writer.userId === me.userId);
      setAgendas(roomAgendas);
      setSelectedAgendaId(
        (roomAgendas.find(({ status }) => status === 'discussing') ?? roomAgendas[0])?.id ?? '',
      );
      setIsPaused(loaded.paused);
      setIsFinished(loaded.status !== 'IN_PROGRESS');
      setElapsedSeconds(elapsedSecondsOf(loaded, Date.now()));
      await reloadLive(loaded.meetingId, loaded.startedAt);
    };
    load().catch((error: unknown) => {
      if (isCurrent) {
        showError(error);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [meetingId, navigate, reloadLive, showError]);

  // REQ-081, 084 멈춘 동안은 경과 시간도 멈춘다
  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
    isPausedRef.current = isPaused;
  }, [elapsedSeconds, isPaused]);

  useEffect(() => {
    if (!isLive || isPaused) {
      return undefined;
    }
    const timerId = window.setInterval(() => setElapsedSeconds((value) => value + 1), TICK_MS);
    return () => window.clearInterval(timerId);
  }, [isLive, isPaused]);

  // REQ-079~080, 082 회의록 작성자 브라우저가 마이크 소리를 STT로 보낸다
  useEffect(() => {
    if (!isWriter || !isLive || numericMeetingId === undefined) {
      return undefined;
    }
    const stream = new SttStream(numericMeetingId, elapsedRef.current * MS_PER_SECOND, isPausedRef.current);
    sttRef.current = stream;
    stream.start().catch(() => setToast({ text: MIC_FAILED_MESSAGE, variant: 'error' }));
    return () => {
      stream.stop();
      sttRef.current = null;
    };
  }, [isWriter, isLive, numericMeetingId]);

  const handleRoomMessage = (message: RoomMessage) => {
    switch (message.type) {
      case 'transcript':
      case 'transcriptEdited':
        setTranscript((prev) => mergeTranscript(prev, toTranscriptLine(message.line, startedAt)));
        break;
      case 'transcriptDeleted':
        setTranscript((prev) => removeTranscript(prev, message.seq, message.rev));
        break;
      case 'paused':
        setIsPaused(true);
        break;
      case 'resumed':
        setIsPaused(false);
        break;
      case 'liveSummary':
        setSummary(toLiveSummary(message.liveSummary));
        break;
      case 'aiStatus':
        setIsAiAvailable(message.available);
        break;
      case 'finished':
        setIsFinished(true);
        break;
    }
  };

  useMeetingRoomSocket(isLive ? numericMeetingId : undefined, {
    onMessage: handleRoomMessage,
    onReconnect: () => {
      if (numericMeetingId !== undefined) {
        reloadLive(numericMeetingId, startedAt).catch(showError);
      }
    },
  });

  if (!detail) {
    return (
      <AppLayout variant="compact" className={styles.page}>
        {toast && <Toast message={toast} onClose={closeToast} />}
      </AppLayout>
    );
  }

  const meetingIdNumber = detail.meetingId;
  const currentAgenda = agendas.find(({ status }) => status === 'discussing');
  const selectedDecision = agendas
    .find(({ id }) => id === selectedAgendaId)
    ?.decisionPoints.find(({ id }) => id === selectedDecisionId);

  const addAgenda = async (title: string, decisionPoint: string) => {
    try {
      const added = await addMeetingAgenda(meetingIdNumber, title, decisionPoint);
      setAgendas((prev) => [...prev, toRoomAgenda(added)]);
      return true;
    } catch (error) {
      showError(error);
      return false;
    }
  };

  const saveDecision = (decisionId: string, decisionSummary: string) => {
    // TODO(API 연동): 결정 내용 수정 API (REQ-126). ai-service 안건 보드(2차)가 생기면 붙인다
    setAgendas((prev) =>
      prev.map((agenda) => ({
        ...agenda,
        decisionPoints: agenda.decisionPoints.map((decision) =>
          decision.id === decisionId ? { ...decision, summary: decisionSummary } : decision,
        ),
      })),
    );
  };

  const saveTranscript = async (seq: number, text: string) => {
    try {
      const edited = await editTranscript(meetingIdNumber, seq, text);
      setTranscript((prev) => mergeTranscript(prev, toTranscriptLine(edited, startedAt)));
    } catch (error) {
      showError(error);
    }
  };

  const togglePause = async () => {
    try {
      if (isPaused) {
        await resumeMeeting(meetingIdNumber);
        sttRef.current?.resume();
      } else {
        await pauseMeeting(meetingIdNumber);
        sttRef.current?.pause();
      }
      setIsPaused(!isPaused);
    } catch (error) {
      showError(error);
    }
  };

  return (
    <AppLayout variant="compact" className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}

      <header className={styles.meetingHeader}>
        <div className={styles.headerInfo}>
          <h1 className={styles.title}>{detail.title}</h1>
          <div className={styles.metaRow}>
            <span className={styles.recording}>
              {isFinished ? (
                <span className={styles.pausedState}>회의 종료</span>
              ) : (
                <span className={isPaused ? styles.pausedState : styles.recordingState}>
                  <img src={isPaused ? dotNotDiscussed : dotRecording} alt="" width={DOT_SIZE} height={DOT_SIZE} />
                  {isPaused ? '일시정지 중' : '녹음 중'}
                </span>
              )}
              <span className={styles.elapsed}>{formatElapsed(elapsedSeconds)}</span>
            </span>
            <span className={styles.attendees}>참여자 {detail.attendees.length}명</span>
            {/* REQ-082 디자인에 없어 글자로만 표시했다 */}
            {!isAiAvailable && <span className={styles.pausedState}>AI 일시 중단</span>}
          </div>
        </div>
        <div className={styles.headerActions}>
          {isWriter && isLive && (
            <button type="button" className={styles.pauseButton} aria-pressed={isPaused} onClick={togglePause}>
              <Placeholder size={BUTTON_ICON_SIZE} />
              {isPaused ? '다시 시작' : '일시정지'}
            </button>
          )}
          <button
            type="button"
            className={styles.endButton}
            onClick={() => setToast({ text: END_PENDING_MESSAGE, variant: 'info' })}
          >
            <Placeholder size={BUTTON_ICON_SIZE} />
            회의 끝내기
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.board}>
          <LiveSummaryCard summary={summary} agenda={currentAgenda} />
          <AgendaStatusCard
            agendas={agendas}
            selectedAgendaId={selectedAgendaId}
            selectedDecisionId={selectedDecisionId}
            canEdit={isWriter && isLive}
            onSelectAgenda={(agendaId) => {
              setSelectedAgendaId(agendaId);
              setSelectedDecisionId(undefined);
            }}
            onSelectDecision={setSelectedDecisionId}
            onSaveDecision={saveDecision}
            onAddAgenda={() => setIsAddOpen(true)}
          />
        </div>

        <aside className={styles.sidePanel} aria-label={selectedDecision ? '결정 근거' : '실시간 전사'}>
          {selectedDecision ? (
            <EvidencePanel
              decision={selectedDecision}
              lines={transcript.filter(({ seq }) => selectedDecision.evidenceSeqs.includes(seq))}
              onClose={() => setSelectedDecisionId(undefined)}
            />
          ) : (
            <TranscriptPanel lines={transcript} canEdit={isWriter && isLive} onEdit={saveTranscript} />
          )}
        </aside>
      </div>

      {isAddOpen && (
        <AddAgendaModal
          onCancel={() => setIsAddOpen(false)}
          onAdd={async (title, decisionPoint) => {
            if (await addAgenda(title, decisionPoint)) {
              setIsAddOpen(false);
            }
          }}
        />
      )}
      {isSuggestionOpen && (
        <AgendaSuggestion
          suggestion={ROOM_SUGGESTION}
          onIgnore={closeSuggestion}
          onRegister={() => {
            // TODO(API 연동): 제안 안건 등록 (REQ-091). 제안에는 결정할 사항이 없다
            void addAgenda(ROOM_SUGGESTION.title, '');
            closeSuggestion();
          }}
        />
      )}
      {isOffTopicOpen && <OffTopicNotice onConfirm={() => setIsOffTopicOpen(false)} />}
    </AppLayout>
  );
}
