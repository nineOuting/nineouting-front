import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import {
  finishMeeting,
  addMeetingAgenda,
  dismissOffTopic,
  editDecision,
  editTranscript,
  getAgendaBoard,
  getLiveSummary,
  getMeetingDetail,
  listTranscripts,
  pauseMeeting,
  resumeMeeting,
  type AgendaBoard,
  type MeetingDetailResponse,
} from '../../api/meeting';
import { getMe } from '../../api/user';
import dotNotDiscussed from '../../assets/dot-not-discussed.svg';
import dotRecording from '../../assets/dot-recording.svg';
import AppLayout from '../../components/AppLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import Placeholder from '../../components/Placeholder';
import Toast, { type ToastMessage } from '../../components/Toast';
import { useMeetingRoomSocket, type RoomMessage } from '../../hooks/useMeetingRoomSocket';
import { SttStream } from '../../meeting/SttStream';
import { ROOM_SUGGESTION } from '../../mocks/meetingRoom';
import type { LiveSummary, RoomAgenda, SuggestedAgenda, TranscriptLine } from '../../types/meetingRoom';
import AddAgendaModal from './room/AddAgendaModal';
import AgendaStatusCard from './room/AgendaStatusCard';
import EvidencePanel from './room/EvidencePanel';
import LiveSummaryCard from './room/LiveSummaryCard';
import { AgendaSuggestion, OffTopicNotice } from './room/RoomNotices';
import {
  applyBoard,
  elapsedSecondsOf,
  formatElapsed,
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
const MIC_FAILED_MESSAGE = '마이크를 쓸 수 없어 녹음하지 못하고 있어요. 브라우저의 마이크 권한을 확인해 주세요.';

/**
 * 새 안건 제안·주제 이탈 알림은 안건 보드의 offTopic으로 띄운다. 화면 확인용으로 주소로도 띄울 수 있다.
 * ?demo=suggestion(새 안건 제안), ?demo=offtopic(주제 이탈 알림)
 */
type DemoScenario = 'suggestion' | 'offtopic' | null;

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
  const [isEndConfirmOpen, setIsEndConfirmOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isAiAvailable, setIsAiAvailable] = useState(true);
  const [selectedAgendaId, setSelectedAgendaId] = useState('');
  const [selectedDecisionId, setSelectedDecisionId] = useState<string>();
  // 안건 추가 창. 새 안건 제안에서 열면 제안된 제목을 채운다
  const [addAgendaTitle, setAddAgendaTitle] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestedAgenda | null>(demo === 'suggestion' ? ROOM_SUGGESTION : null);
  const [isOffTopicOpen, setIsOffTopicOpen] = useState(demo === 'offtopic');
  // 안건 보드가 정한 지금 논의 중인 안건
  const [currentAgendaId, setCurrentAgendaId] = useState<string>();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  // 안건 보드는 회의방 메시지와 API 두 길로 온다. 늦게 온 옛 버전은 버린다
  const boardVersionRef = useRef(0);
  // 지금 보드의 새 안건 제안·주제 이탈 알림과 사용자가 닫은 알림 (같은 알림이 다음 보드로 또 와도 다시 띄우지 않는다)
  const offTopicKeyRef = useRef<string | null>(null);
  const closedOffTopicRef = useRef<string | null>(null);
  const closeSuggestion = useCallback(() => {
    closedOffTopicRef.current = offTopicKeyRef.current;
    setSuggestion(null);
  }, []);
  const sttRef = useRef<SttStream | null>(null);
  // STT 연결을 새로 열 때 이어 보낼 음성 위치·멈춤 상태 (바뀔 때마다 다시 열지 않도록 ref로 읽는다)
  const elapsedRef = useRef(0);
  const isPausedRef = useRef(false);
  // 마무리하는 중이면 화면을 떠날 때 STT를 끊지 않고 end를 보낸다
  const isFinishingRef = useRef(false);
  const numericMeetingId = detail?.meetingId;
  const isLive = detail?.status === 'IN_PROGRESS' && !isFinished;

  const showError = useCallback((error: unknown) => setToast({ text: errorMessage(error), variant: 'error' }), []);

  /** REQ-085~092, 124~125 안건 보드를 화면에 입힌다 */
  const showBoard = useCallback((board: AgendaBoard) => {
    if (board.version <= boardVersionRef.current) {
      return;
    }
    boardVersionRef.current = board.version;
    setAgendas((prev) => applyBoard(prev, board));
    setCurrentAgendaId(board.currentAgendaId === null ? undefined : String(board.currentAgendaId));
    const offTopic = board.offTopic;
    const key = offTopic && `${offTopic.stage}:${offTopic.detectedAt}`;
    offTopicKeyRef.current = key;
    const isClosed = key !== null && key === closedOffTopicRef.current;
    setSuggestion(offTopic?.stage === 'SUGGEST' && !isClosed ? { title: offTopic.suggestedTitle ?? '' } : null);
    setIsOffTopicOpen(offTopic?.stage === 'LONG' && !isClosed);
  }, []);

  /** 처음 들어올 때와 회의방 연결이 끊겼다 다시 붙을 때 지금 상태를 다시 받는다 */
  const reloadLive = useCallback(
    async (id: number) => {
      const [lines, live, board] = await Promise.all([listTranscripts(id), getLiveSummary(id), getAgendaBoard(id)]);
      setTranscript(lines.map((line) => toTranscriptLine(line)).sort((a, b) => a.startMs - b.startMs));
      setSummary(toLiveSummary(live));
      if (board) {
        showBoard(board);
      }
    },
    [showBoard],
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
      // 이미 끝난 회의는 회의록 작성 화면으로 (REQ-098)
      if (loaded.status === 'FINISHED') {
        navigate(`/meetings/${loaded.meetingId}/minutes`, { replace: true });
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
      await reloadLive(loaded.meetingId);
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
      // 회의방의 finished가 마무리 응답보다 먼저 와서 화면을 떠날 수 있다. 그때도 end를 보낸다
      if (isFinishingRef.current) {
        void stream.end();
      } else {
        stream.stop();
      }
      sttRef.current = null;
    };
  }, [isWriter, isLive, numericMeetingId]);

  const handleRoomMessage = (message: RoomMessage) => {
    switch (message.type) {
      case 'transcript':
      case 'transcriptEdited':
        setTranscript((prev) => mergeTranscript(prev, toTranscriptLine(message.line)));
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
      case 'agendaBoard':
        showBoard(message.data);
        break;
      case 'finished':
        // REQ-098 작성자가 회의를 마무리하면 참석자 모두 회의록 작성 화면으로 간다
        setIsFinished(true);
        if (numericMeetingId !== undefined) {
          navigate(`/meetings/${numericMeetingId}/minutes`, { replace: true });
        }
        break;
    }
  };

  useMeetingRoomSocket(isLive ? numericMeetingId : undefined, {
    onMessage: handleRoomMessage,
    onReconnect: () => {
      if (numericMeetingId !== undefined) {
        reloadLive(numericMeetingId).catch(showError);
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
  const currentAgenda =
    agendas.find(({ id }) => id === currentAgendaId) ?? agendas.find(({ status }) => status === 'discussing');
  // REQ-087 주요 의견·아직 합의되지 않은 부분은 지금 논의 중인 안건의 안건 보드에서 가져온다
  const shownSummary =
    summary && currentAgenda
      ? { ...summary, opinions: currentAgenda.opinions, openIssues: currentAgenda.openIssues }
      : summary;
  const selectedDecision = agendas
    .find(({ id }) => id === selectedAgendaId)
    ?.decisionPoints.find(({ id }) => id === selectedDecisionId);

  const addAgenda = async (title: string, decisionPoints: string[]) => {
    try {
      const added = await addMeetingAgenda(meetingIdNumber, title, decisionPoints);
      setAgendas((prev) => [...prev, toRoomAgenda(added)]);
      return true;
    } catch (error) {
      showError(error);
      return false;
    }
  };

  /** REQ-126 고친 결정 내용은 ai-service로 가고, 고친 표시가 붙은 보드가 회의방으로 다시 온다. 근거 발언은 그대로 둔다 */
  const saveDecision = async (decisionId: string, decisionSummary: string) => {
    const agenda = agendas.find(({ decisionPoints }) => decisionPoints.some(({ id }) => id === decisionId));
    const decision = agenda?.decisionPoints.find(({ id }) => id === decisionId);
    if (!agenda || !decision) {
      return;
    }
    const replaceDecision = (next: typeof decision) =>
      setAgendas((prev) =>
        prev.map((item) => ({
          ...item,
          decisionPoints: item.decisionPoints.map((point) => (point.id === decisionId ? next : point)),
        })),
      );
    replaceDecision({ ...decision, summary: decisionSummary });
    try {
      await editDecision(meetingIdNumber, Number(agenda.id), Number(decisionId), decisionSummary, decision.evidenceSeqs);
    } catch (error) {
      showError(error);
      replaceDecision(decision);
    }
  };

  /** REQ-091 [무시]·REQ-092 [확인]. 같은 알림은 다시 띄우지 않고 ai-service에 알린다 (회의록 작성자만 연다) */
  const dismissNotice = () => {
    closedOffTopicRef.current = offTopicKeyRef.current;
    setSuggestion(null);
    setIsOffTopicOpen(false);
    if (demo === null) {
      dismissOffTopic(meetingIdNumber).catch(showError);
    }
  };

  const saveTranscript = async (seq: number, text: string) => {
    try {
      const edited = await editTranscript(meetingIdNumber, seq, text);
      setTranscript((prev) => mergeTranscript(prev, toTranscriptLine(edited)));
    } catch (error) {
      showError(error);
    }
  };

  /** REQ-098 마무리하면 회의록이 만들어지고 회의록 작성 화면으로 간다 (만들어지기 전에는 그 화면이 "준비 중"을 보여 준다) */
  const endMeeting = async () => {
    setIsEndConfirmOpen(false);
    setIsEnding(true);
    isFinishingRef.current = true;
    try {
      await finishMeeting(meetingIdNumber);
      // 마무리한 뒤 STT에 끝을 알린다. 말하던 줄을 확정해 보내고 회의 종료(end)가 백엔드에 간다 (화면을 떠나도 이어서 보낸다).
      // 먼저 보내면 마무리가 실패했을 때 ai-service는 이미 회의를 끝낸 상태가 된다
      void sttRef.current?.end();
      setIsFinished(true);
      navigate(`/meetings/${meetingIdNumber}/minutes`, { replace: true });
    } catch (error) {
      // 마무리하지 못했으므로 STT는 그대로 이어서 보낸다
      isFinishingRef.current = false;
      showError(error);
      setIsEnding(false);
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
          {/* REQ-098 회의록 작성자만 마무리한다. 회의 끝내기 단계(REQ-093~097)는 디자인이 없어 건너뛰고 바로 회의록으로 간다 */}
          {isWriter && isLive && (
            <button type="button" className={styles.endButton} disabled={isEnding} onClick={() => setIsEndConfirmOpen(true)}>
              <Placeholder size={BUTTON_ICON_SIZE} />
              회의 끝내기
            </button>
          )}
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.board}>
          <LiveSummaryCard summary={shownSummary} agenda={currentAgenda} />
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
            onSaveDecision={(decisionId, decisionSummary) => void saveDecision(decisionId, decisionSummary)}
            onAddAgenda={() => setAddAgendaTitle('')}
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

      {addAgendaTitle !== null && (
        <AddAgendaModal
          initialTitle={addAgendaTitle}
          onCancel={() => setAddAgendaTitle(null)}
          onAdd={async (title, decisionPoints) => {
            if (await addAgenda(title, decisionPoints)) {
              setAddAgendaTitle(null);
            }
          }}
        />
      )}
      {/* 등록·무시는 회의록 작성자만 한다 */}
      {suggestion && isWriter && isLive && (
        <AgendaSuggestion
          suggestion={suggestion}
          onIgnore={dismissNotice}
          // 30초가 지나면 백엔드가 무시로 보낸다
          onExpire={closeSuggestion}
          onRegister={() => {
            // 제안에는 결정할 사항이 없어 안건 추가 창을 제목만 채워 연다 (결정할 사항 1개 이상 필수)
            setAddAgendaTitle(suggestion.title);
            closeSuggestion();
          }}
        />
      )}
      {isOffTopicOpen && isWriter && isLive && <OffTopicNotice onConfirm={dismissNotice} />}
      {isEndConfirmOpen && (
        <ConfirmDialog
          title="회의를 끝낼까요?"
          message="녹음과 받아쓰기를 끝내고 회의록 작성 화면으로 이동해요. 끝낸 회의는 다시 시작할 수 없어요."
          cancelLabel="계속 진행"
          confirmLabel="회의 끝내기"
          onCancel={() => setIsEndConfirmOpen(false)}
          onConfirm={endMeeting}
        />
      )}
    </AppLayout>
  );
}
