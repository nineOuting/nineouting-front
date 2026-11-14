import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import {
  finishMeeting,
  addMeetingAgenda,
  deleteMeetingAgenda,
  renameMeetingAgenda,
  cancelMeetingEnd,
  carryOverAgendas,
  correctLineAgenda,
  dismissOffTopic,
  editAgendaItem,
  editDecision,
  editTranscript,
  getAgendaBoard,
  getMeetingDetail,
  listLineAgendas,
  listTranscripts,
  pauseMeeting,
  requestMeetingEnd,
  setDecisionStatus,
  type DecisionStatusEdit,
  resumeMeeting,
  type AgendaBoard,
  type BoardEndSnapshot,
  type MeetingDetailResponse,
} from '../../api/meeting';
import { getMe } from '../../api/user';
import chevronLeftIcon from '../../assets/icons/chevron-left.svg';
import stopIcon from '../../assets/icons/stop.svg';
import infoIcon from '../../assets/icons/info.svg';
import visibilityIcon from '../../assets/icons/visibility.svg';
import AiNotice from '../../components/AiNotice';
import Button from '../../components/Button';
import Coachmark from '../../components/Coachmark';
import ConfirmDialog from '../../components/ConfirmDialog';
import Dialog from '../../components/Dialog';
import Icon from '../../components/Icon';
import TextField from '../../components/TextField';
import Toast, { type ToastMessage } from '../../components/Toast';
import { useMeetingRoomSocket, type RoomMessage } from '../../hooks/useMeetingRoomSocket';
import { SttStream } from '../../meeting/SttStream';
import { ROOM_SUGGESTION } from '../../mocks/meetingRoom';
import type { DecisionPoint, RoomAgenda, RoomSummaryItem, RoomTodo, SuggestedAgenda, TranscriptLine } from '../../types/meetingRoom';
import AddAgendaModal from './room/AddAgendaModal';
import AgendaFocus from './room/AgendaFocus';
import AgendaNav from './room/AgendaNav';
import ChatPanel from './room/ChatPanel';
import EndMeetingModal, { type EndStep } from './room/EndMeetingModal';
import type { TodoChange } from './room/TodoList';
import EvidencePanel from './room/EvidencePanel';
import { AgendaSuggestion, OffTopicNotice } from './room/RoomNotices';
import {
  applyBoard,
  summaryAgendas,
  elapsedSecondsOf,
  mergeTranscript,
  removeTranscript,
  snapshotAgendas,
  toRoomAgenda,
  toTranscriptLine,
} from './room/roomData';
import RecordingBar from './room/RecordingBar';
import RoomBanner, { SilenceNotice } from './room/RoomBanner';
import { askAbout, detectTerms } from './room/termGlossary';
import TranscriptPanel from './room/TranscriptPanel';
import styles from './MeetingRoomPage.module.css';

// REQ-174 첫 사용 안내를 본 적 있는지 (브라우저에 남긴다)
const ONBOARDING_KEY = 'nepnep-room-onboarding';
const AGENDA_TITLE_MAX_LENGTH = 100;
const SMALL_ICON_SIZE = 16;
const BACK_ICON_SIZE = 24;
const HEADER_AVATAR_COUNT = 4;
const TICK_MS = 1000;
const MS_PER_SECOND = 1000;
// 디자인 Live_15: 녹음 중인데 이만큼 전사가 오지 않으면 마이크를 확인하라고 알린다
const SILENCE_SECONDS = 20;
const MIC_FAILED_MESSAGE = '마이크를 쓸 수 없어 녹음하지 못하고 있어요. 브라우저의 마이크 권한을 확인해 주세요.';

/**
 * 새 안건 제안·주제 이탈 알림은 안건 보드의 offTopic으로 띄운다. 화면 확인용으로 주소로도 띄울 수 있다.
 * ?demo=suggestion(새 안건 제안), ?demo=offtopic(주제 이탈 알림)
 */
type DemoScenario = 'suggestion' | 'offtopic' | null;

/** REQ-089 서버의 안건 id(숫자, 해당 없음은 null)를 화면의 안건 id(문자열)로 */
function toLineAgendaId(agendaId: number | null) {
  return agendaId === null ? null : String(agendaId);
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  // REQ-093~098 회의 끝내기 단계와, 끝내기 요청 뒤 보드로 오는 남은 안건 목록·오늘 회의 요약
  const [endStep, setEndStep] = useState<EndStep | null>(null);
  const [leftover, setLeftover] = useState<BoardEndSnapshot | null>(null);
  const [todaySummary, setTodaySummary] = useState<BoardEndSnapshot | null>(null);
  const [carriedIds, setCarriedIds] = useState<string[]>([]);
  const [isEndBusy, setIsEndBusy] = useState(false);
  // REQ-097 작성자가 아닌 참석자가 오늘 회의 요약 창을 닫았는지 (요약이 다시 오면 다시 연다)
  const [isViewerSummaryClosed, setIsViewerSummaryClosed] = useState(false);
  // REQ-089 줄마다 안건 (seq → 안건 id). 작성자가 고친 줄은 자동 분류로 덮지 않는다
  const [lineAgendas, setLineAgendas] = useState<Record<number, string | null>>({});
  const correctedSeqsRef = useRef(new Set<number>());
  const [isEnding, setIsEnding] = useState(false);
  const [isAiAvailable, setIsAiAvailable] = useState(true);
  const [selectedAgendaId, setSelectedAgendaId] = useState('');
  const [selectedDecisionId, setSelectedDecisionId] = useState<string>();
  // REQ-185 오른쪽 패널: 실시간 전사 / 챗봇 (임시 디자인)
  const [sideTab, setSideTab] = useState<'transcript' | 'chat'>('transcript');
  // 용어 카드 [더 묻기]로 내 도우미를 열 때 채울 질문. 바뀔 때마다 내 도우미를 새로 그린다
  const [helperQuery, setHelperQuery] = useState<{ text: string; key: number } | null>(null);
  // 내 도우미 탭을 마지막으로 본 때까지 알려 준 용어 수 (그 뒤로 새로 나온 용어를 탭에 표시)
  const [seenTermCount, setSeenTermCount] = useState(0);
  // 안건 추가 창. 새 안건 제안에서 열면 제안된 제목을 채운다
  const [addAgendaTitle, setAddAgendaTitle] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestedAgenda | null>(demo === 'suggestion' ? ROOM_SUGGESTION : null);
  const [isOffTopicOpen, setIsOffTopicOpen] = useState(demo === 'offtopic');
  // 안건 보드가 정한 지금 논의 중인 안건
  const [currentAgendaId, setCurrentAgendaId] = useState<string>();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  // 마지막 전사가 온 때 (소리 없음 안내용). 안내를 닫으면 다음 전사가 올 때까지 다시 띄우지 않는다
  const lastLineAtRef = useRef(0);
  const [silentSeconds, setSilentSeconds] = useState(0);
  // 안내를 닫았을 때의 전사 줄 수. 새 줄이 오면 다시 띄울 수 있다
  const [silenceDismissedAt, setSilenceDismissedAt] = useState<number | null>(null);
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
  // REQ-171 회의 화면 나가기 확인 (MSG-068)
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  // REQ-173 안건 수정하기, 안건 삭제
  const [renaming, setRenaming] = useState<{ agendaId: string; title: string } | null>(null);
  const [deletingAgendaId, setDeletingAgendaId] = useState<string | null>(null);
  // REQ-174 회의 중 화면을 처음 열면 한 번만 안내한다
  const [isOnboarding, setIsOnboarding] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) !== 'done';
    } catch {
      return false;
    }
  });
  const finishOnboarding = useCallback(() => {
    setIsOnboarding(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, 'done');
    } catch {
      // 저장하지 못하면 다음에 한 번 더 보일 뿐이다
    }
  }, []);

  // REQ-082 인터넷이 끊기면 가운데 위에 빨간 줄로 알린다 (끊긴 동안의 소리는 SttStream이 모아 두었다가 보낸다)
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    lastLineAtRef.current = Date.now();
  }, [transcript]);

  // REQ-171 회의 중에 새로고침, 탭 닫기, 브라우저 뒤로 가기로 나가려 하면 확인한다
  useEffect(() => {
    if (!isLive) {
      return undefined;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    // 뒤로 가기를 한 번 받아 둘 자리를 쌓아 두고, 뒤로 가면 다시 쌓은 뒤 확인 창을 띄운다
    window.history.pushState({ roomGuard: true }, '');
    const handlePopState = () => {
      window.history.pushState({ roomGuard: true }, '');
      setIsLeaveOpen(true);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isLive]);

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
    setLeftover(board.leftover ?? null);
    setTodaySummary(board.todaySummary ?? null);
    if (!board.leftover && !board.todaySummary) {
      setIsViewerSummaryClosed(false);
    }
  }, []);

  /** 처음 들어올 때와 회의방 연결이 끊겼다 다시 붙을 때 지금 상태를 다시 받는다 */
  const reloadLive = useCallback(
    async (id: number) => {
      const [lines, board, classified] = await Promise.all([
        listTranscripts(id),
        getAgendaBoard(id),
        listLineAgendas(id).catch(() => []),
      ]);
      setTranscript(lines.map((line) => toTranscriptLine(line)).sort((a, b) => a.startMs - b.startMs));
      if (board) {
        showBoard(board);
      }
      correctedSeqsRef.current = new Set(classified.filter(({ corrected }) => corrected).map(({ seq }) => seq));
      setLineAgendas(Object.fromEntries(classified.map(({ seq, agendaId }) => [seq, toLineAgendaId(agendaId)])));
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

  useEffect(() => {
    if (!isWriter || !isLive || isPaused) {
      return undefined;
    }
    lastLineAtRef.current = Date.now();
    const timerId = window.setInterval(
      () => setSilentSeconds(Math.floor((Date.now() - lastLineAtRef.current) / MS_PER_SECOND)),
      TICK_MS,
    );
    return () => window.clearInterval(timerId);
  }, [isWriter, isLive, isPaused]);

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
      case 'aiStatus':
        setIsAiAvailable(message.available);
        break;
      case 'agendaBoard':
        showBoard(message.data);
        break;
      case 'agendaClassification': {
        const changed = message.data.lines.filter(({ seq }) => !correctedSeqsRef.current.has(seq));
        setLineAgendas((prev) => ({
          ...prev,
          ...Object.fromEntries(changed.map(({ seq, agendaId }) => [seq, toLineAgendaId(agendaId)])),
        }));
        break;
      }
      case 'lineAgenda':
        correctedSeqsRef.current.add(message.data.seq);
        setLineAgendas((prev) => ({ ...prev, [message.data.seq]: toLineAgendaId(message.data.agendaId) }));
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
      <div className={styles.page}>{toast && <Toast message={toast} onClose={closeToast} />}</div>
    );
  }

  const meetingIdNumber = detail.meetingId;

  // REQ-171 나가도 녹음, 전사는 계속되고 다시 들어올 수 있다
  const leaveRoom = () => {
    setIsLeaveOpen(false);
    navigate(`/folders/${detail.folderId}`, { replace: true });
  };

  const renameAgenda = async () => {
    if (!renaming || !renaming.title.trim()) {
      return;
    }
    try {
      const saved = await renameMeetingAgenda(meetingIdNumber, Number(renaming.agendaId), renaming.title.trim());
      setAgendas((prev) => prev.map((agenda) => (agenda.id === renaming.agendaId ? { ...agenda, title: saved.title } : agenda)));
      setRenaming(null);
    } catch (error) {
      showError(error);
    }
  };

  const deleteAgenda = async (agendaId: string) => {
    setDeletingAgendaId(null);
    try {
      await deleteMeetingAgenda(meetingIdNumber, Number(agendaId));
      setAgendas((prev) => prev.filter(({ id }) => id !== agendaId));
      if (selectedAgendaId === agendaId) {
        setSelectedAgendaId('');
        setSelectedDecisionId(undefined);
      }
    } catch (error) {
      showError(error);
    }
  };
  // REQ-093·096 끝내기 요청 뒤 남은 안건 목록이 오면: 비었으면 바로 오늘 회의 요약, 아니면 목록
  const shownEndStep: EndStep | null =
    endStep === 'waiting' && leftover ? (leftover.agendas.length === 0 ? 'summary' : 'leftover') : endStep;
  // REQ-097 다른 참석자도 작성자가 끝내기를 누르면 같은 요약을 본다 (읽기만)
  const viewerEndStep: EndStep | null =
    !isWriter && isLive && (leftover || todaySummary) ? (todaySummary ? 'summary' : 'leftover') : null;
  const currentAgenda =
    agendas.find(({ id }) => id === currentAgendaId) ?? agendas.find(({ status }) => status === 'discussing');
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

  /** 안건의 결정할 사항을 바꾼다 (낙관적 반영과 되돌리기에 쓴다) */
  const updateDecisions = (agendaId: string, update: (point: DecisionPoint) => DecisionPoint) =>
    setAgendas((prev) =>
      prev.map((agenda) => (agenda.id === agendaId ? { ...agenda, decisionPoints: agenda.decisionPoints.map(update) } : agenda)),
    );

  /** 정한 상태를 바로 화면에 보인다. AI 판정으로 되돌리면 상태는 다음 보드가 정한다 */
  const editedPoint = (point: DecisionPoint, status: DecisionStatusEdit): DecisionPoint =>
    status === 'AUTO'
      ? { ...point, statusEdited: false }
      : { ...point, status: status === 'DECIDED' ? 'decided' : 'undecided', statusEdited: true };

  /** 결정할 사항 상태 정하기. 사용자가 정하면 AI가 전사로 바꾸지 않는다 (ai-service status-edits) */
  const changeDecisionStatus = async (agendaId: string, decisionId: string, status: DecisionStatusEdit) => {
    const before = agendas.find(({ id }) => id === agendaId)?.decisionPoints.find(({ id }) => id === decisionId);
    if (!before) {
      return;
    }
    updateDecisions(agendaId, (point) => (point.id === decisionId ? editedPoint(point, status) : point));
    try {
      await setDecisionStatus(meetingIdNumber, Number(agendaId), Number(decisionId), status);
    } catch (error) {
      showError(error);
      updateDecisions(agendaId, (point) => (point.id === decisionId ? before : point));
    }
  };

  /** REQ-097 요약 문장 고치기. 고친 보드가 회의방으로 다시 온다 */
  const saveSummaryItem = async (agendaId: string, item: RoomSummaryItem, text: string) => {
    const before = agendas.find(({ id }) => id === agendaId);
    if (!before) {
      return;
    }
    const replace = (items: RoomSummaryItem[]) =>
      setAgendas((prev) =>
        prev.map((agenda) => (agenda.id === agendaId ? { ...agenda, summaryItems: items, summary: items.map((one) => one.text) } : agenda)),
      );
    replace((before.summaryItems ?? []).map((one) => (one.id === item.id ? { ...one, text } : one)));
    try {
      await editAgendaItem(meetingIdNumber, 'summary', item.id, { agendaId: Number(agendaId), text, evidenceSeqs: item.evidenceSeqs });
    } catch (error) {
      showError(error);
      replace(before.summaryItems ?? []);
    }
  };

  /** REQ-097 할 일, 담당자, 기한 고치기. 담당자 이름을 바꾸면 명단과 다시 맞추게 사용자 번호는 비운다 */
  const saveTodo = async (agendaId: string, todo: RoomTodo, change: TodoChange) => {
    const before = agendas.find(({ id }) => id === agendaId);
    if (!before) {
      return;
    }
    const sameAssignee = (todo.assignee ?? '') === change.assignee;
    const next: RoomTodo = {
      ...todo,
      task: change.task,
      assignee: change.assignee || undefined,
      due: change.due || undefined,
      assigneeStatus: change.assignee ? (sameAssignee ? todo.assigneeStatus : null) : 'UNASSIGNED',
      assigneeUserId: sameAssignee ? todo.assigneeUserId : null,
    };
    const replace = (todos: RoomTodo[]) =>
      setAgendas((prev) => prev.map((agenda) => (agenda.id === agendaId ? { ...agenda, todos } : agenda)));
    replace(before.todos.map((one) => (one.id === todo.id ? next : one)));
    try {
      await editAgendaItem(meetingIdNumber, 'todos', todo.id, {
        agendaId: Number(agendaId),
        task: change.task,
        assigneeName: change.assignee || null,
        assigneeUserId: next.assigneeUserId ?? null,
        dueText: change.due || null,
        evidenceSeqs: todo.evidenceSeqs ?? [],
      });
    } catch (error) {
      showError(error);
      replace(before.todos);
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

  /** REQ-089 줄의 안건 고치기. 결과는 회의방(lineAgenda)으로도 온다 */
  const changeLineAgenda = async (seq: number, agendaId: string | null) => {
    try {
      const corrected = await correctLineAgenda(meetingIdNumber, seq, agendaId === null ? null : Number(agendaId));
      correctedSeqsRef.current.add(seq);
      setLineAgendas((prev) => ({ ...prev, [seq]: toLineAgendaId(corrected.agendaId) }));
    } catch (error) {
      showError(error);
    }
  };

  /** REQ-093 [회의 끝내기]: AI가 결론 나지 않은 안건과 오늘 회의 요약을 정리하는 동안 기다린다 (녹음은 이어진다) */
  const startEnd = async () => {
    // 이어서 논의하기 전의 목록·요약이 남아 있으면 새로 정리한 값이 오기 전에 보이므로 비운다
    setLeftover(null);
    setTodaySummary(null);
    setCarriedIds([]);
    setEndStep('waiting');
    try {
      await requestMeetingEnd(meetingIdNumber);
    } catch (error) {
      showError(error);
      setEndStep(null);
    }
  };

  /** REQ-095 [이어서 논의하기]: 끝내기 요청을 거두고 회의로 돌아간다 */
  const continueMeeting = async () => {
    setIsEndBusy(true);
    try {
      await cancelMeetingEnd(meetingIdNumber);
      setEndStep(null);
    } catch (error) {
      showError(error);
    } finally {
      setIsEndBusy(false);
    }
  };

  /** REQ-094 고른 안건을 다음 회의로 넘기고 오늘 회의 요약으로 */
  const carryOver = async (agendaIds: string[]) => {
    setIsEndBusy(true);
    try {
      if (agendaIds.length > 0) {
        await carryOverAgendas(meetingIdNumber, agendaIds.map(Number));
      }
      setCarriedIds(agendaIds);
      setEndStep('summary');
    } catch (error) {
      showError(error);
    } finally {
      setIsEndBusy(false);
    }
  };

  /** REQ-098 마무리하면 회의록이 만들어지고 회의록 작성 화면으로 간다 (만들어지기 전에는 그 화면이 "준비 중"을 보여 준다) */
  const endMeeting = async () => {
    setEndStep(null);
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

  const focusedAgenda = agendas.find(({ id }) => id === selectedAgendaId) ?? currentAgenda ?? agendas[0];
  const plannedMinutes = Math.round((new Date(detail.endAt).getTime() - new Date(detail.startAt).getTime()) / 60000);
  const writerName = detail.writer.name ?? '알 수 없음';
  const terms = detectTerms(transcript.map(({ text }) => text));
  const newTermCount = sideTab === 'chat' ? 0 : Math.max(0, terms.length - seenTermCount);
  const openHelper = (query?: string) => {
    setSideTab('chat');
    setSeenTermCount(terms.length);
    setSelectedDecisionId(undefined);
    if (query) {
      setHelperQuery({ text: query, key: Date.now() });
    }
  };
  const overMinutes = plannedMinutes > 0 ? Math.floor(elapsedSeconds / 60) - plannedMinutes : 0;
  const leftAgendaCount = agendas.filter(({ status }) => status !== 'decided').length;
  // 안건을 언제부터 얼마나 이야기했는지: 그 안건으로 나뉜 첫 전사 줄부터 지금(지난 안건은 마지막 줄)까지
  const agendaLines = focusedAgenda ? transcript.filter(({ seq }) => lineAgendas[seq] === focusedAgenda.id) : [];
  const startedAtMs = detail.startedAt ? new Date(detail.startedAt).getTime() : undefined;
  const timing =
    agendaLines.length > 0 && startedAtMs !== undefined
      ? {
          since: new Date(startedAtMs + agendaLines[0].startMs).toTimeString().slice(0, 5),
          minutes: Math.max(
            0,
            Math.floor(
              ((focusedAgenda?.id === currentAgenda?.id ? elapsedSeconds * MS_PER_SECOND : agendaLines[agendaLines.length - 1].startMs) -
                agendaLines[0].startMs) /
                60000,
            ),
          ),
        }
      : undefined;

  return (
    <div className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}

      {/* 디자인 Version02 Live 상단 바: 뒤로 가기, 회의명, 참여자 얼굴 / 회의 끝내기(작성자), 보기 전용(참석자) */}
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="뒤로 가기"
            onClick={() => (isLive ? setIsLeaveOpen(true) : navigate(-1))}
          >
            <Icon src={chevronLeftIcon} size={BACK_ICON_SIZE} />
          </button>
          <h1 className={styles.title}>{detail.title}</h1>
          <span className={styles.avatars} aria-label={`참여자 ${detail.attendees.length}명`}>
            {detail.attendees.slice(0, HEADER_AVATAR_COUNT).map((person) =>
              person.profileImageUrl ? (
                <img key={person.userId} src={person.profileImageUrl} alt={person.name ?? ''} className={styles.avatar} />
              ) : (
                <span key={person.userId} className={styles.avatar} role="img" aria-label={person.name ?? ''}>
                  {(person.name ?? '?').slice(0, 1)}
                </span>
              ),
            )}
          </span>
        </div>
        <div className={styles.topRight}>
          {viewerEndStep && isViewerSummaryClosed && (
            <Button variant="secondary" size="md" onClick={() => setIsViewerSummaryClosed(false)}>
              오늘 회의 요약 보기
            </Button>
          )}
          {isWriter && isLive ? (
            <Button size="md" disabled={isEnding || endStep !== null} onClick={() => void startEnd()}>
              <Icon src={stopIcon} size={SMALL_ICON_SIZE} />
              회의 끝내기
            </Button>
          ) : (
            <span className={styles.viewerPill}>
              <Icon src={visibilityIcon} size={SMALL_ICON_SIZE} />
              보기 전용 · 회의록 작성자 {writerName}
            </span>
          )}
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.agendaNav}>
          <AgendaNav
            agendas={agendas}
            selectedAgendaId={focusedAgenda?.id ?? ''}
            currentAgendaId={currentAgenda?.id}
            onSelect={(agendaId) => {
              setSelectedAgendaId(agendaId);
              setSelectedDecisionId(undefined);
            }}
            {...(isWriter &&
              isLive && {
                onAdd: () => setAddAgendaTitle(''),
                onRename: (agendaId: string) =>
                  setRenaming({ agendaId, title: agendas.find(({ id }) => id === agendaId)?.title ?? '' }),
                onDelete: setDeletingAgendaId,
              })}
          />
        </aside>

        <main className={styles.board}>
          {!isOnline && (
            <RoomBanner
              tone="danger"
              title="인터넷 연결이 끊겼어요. 녹음은 계속되고, 다시 연결되면 자동으로 올려요"
              action={{ label: '다시 연결', onClick: () => void reloadLive(meetingIdNumber).catch(showError) }}
            />
          )}
          {isOnline && !isAiAvailable && (
            <RoomBanner
              tone="info"
              title="AI가 잠시 멈췄어요"
              description="녹음과 전사는 계속돼요. 다시 연결되면 밀린 내용을 한꺼번에 정리해요"
            />
          )}
          {isLive && isPaused && (
            <RoomBanner
              tone="neutral"
              title="녹음이 멈춰 있어요. 지금 하는 말은 기록되지 않아요"
              action={isWriter ? { label: '다시 시작', onClick: () => void togglePause() } : undefined}
            />
          )}
          {isLive && !isPaused && overMinutes > 0 && (
            <RoomBanner
              tone="warning"
              title={`예정 시간을 ${overMinutes}분 넘겼어요`}
              description={`남은 안건 ${leftAgendaCount}개 · 다음 회의로 넘기거나 이어서 논의할 수 있어요`}
            />
          )}
          {isWriter && isLive && !isPaused && silentSeconds >= SILENCE_SECONDS && silenceDismissedAt !== transcript.length && (
            <SilenceNotice
              seconds={silentSeconds}
              onDismiss={() => setSilenceDismissedAt(transcript.length)}
              onCheckMic={() => {
                setSilenceDismissedAt(transcript.length);
                setToast({ text: '브라우저 주소창의 마이크 아이콘에서 입력 장치와 음소거를 확인해 주세요.', variant: 'info' });
              }}
            />
          )}
          <div className={styles.boardContent}>
          <AgendaFocus
            agenda={focusedAgenda}
            isCurrent={Boolean(focusedAgenda) && focusedAgenda?.id === currentAgenda?.id}
            isPaused={isPaused}
            isAiAvailable={isAiAvailable}
            timing={timing}
            onAddDecision={() =>
              setToast({ text: '회의 중 결정할 사항 추가는 곧 지원돼요. 지금은 안건을 추가해 주세요.', variant: 'info' })
            }
            selectedDecisionId={selectedDecisionId}
            canEdit={isWriter && isLive}
            notice={<AiNotice meetingId={meetingIdNumber} target="LIVE_SUMMARY" />}
            onSelectDecision={setSelectedDecisionId}
            onSaveDecision={(decisionId, decisionSummary) => void saveDecision(decisionId, decisionSummary)}
            onChangeDecisionStatus={(decisionId, status) => {
              if (focusedAgenda) {
                void changeDecisionStatus(focusedAgenda.id, decisionId, status);
              }
            }}
            onSaveTodo={(todo, change) => {
              if (focusedAgenda) {
                void saveTodo(focusedAgenda.id, todo, change);
              }
            }}
          />
          </div>
        </main>

        <aside
          id="room-side-panel"
          className={styles.sidePanel}
          aria-label={selectedDecision ? '결정 근거' : sideTab === 'chat' ? '내 도우미' : '실시간 전사'}
        >
          {!selectedDecision && (
            <div className={styles.tabs} role="tablist">
              {(['transcript', 'chat'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={sideTab === tab}
                  className={[styles.tab, sideTab === tab ? styles.tabActive : ''].filter(Boolean).join(' ')}
                  onClick={() => (tab === 'chat' ? openHelper() : setSideTab(tab))}
                >
                  {tab === 'chat' ? '내 도우미' : '실시간 전사'}
                  {tab === 'chat' && newTermCount > 0 && <span className={styles.tabBadge}>용어 {newTermCount}</span>}
                </button>
              ))}
            </div>
          )}
          {selectedDecision ? (
            <EvidencePanel
              decision={selectedDecision}
              lines={transcript.filter(({ seq }) => selectedDecision.evidenceSeqs.includes(seq))}
              onClose={() => setSelectedDecisionId(undefined)}
              notice={<AiNotice meetingId={meetingIdNumber} target="DECISION_EVIDENCE" />}
            />
          ) : sideTab === 'chat' ? (
            <ChatPanel
              key={helperQuery?.key ?? 'helper'}
              meetingId={meetingIdNumber}
              canAsk={isLive}
              initialQuery={helperQuery?.text}
              suggestions={['방금 5분 요약해 줘', '지난 회의에서 비슷한 얘기 찾아줘', ...terms.slice(0, 1).map(askAbout)]}
            />
          ) : (
            <TranscriptPanel
              lines={transcript}
              canEdit={isWriter && isLive}
              onEdit={saveTranscript}
              lineAgendas={lineAgendas}
              agendaOptions={agendas.map(({ id, title }) => ({ id, title }))}
              onChangeAgenda={(seq, agendaId) => void changeLineAgenda(seq, agendaId)}
              onAskTerm={(term) => openHelper(askAbout(term))}
              isOffline={!isOnline}
            />
          )}
        </aside>
      </div>

      <RecordingBar
        elapsedSeconds={elapsedSeconds}
        plannedMinutes={plannedMinutes > 0 ? plannedMinutes : undefined}
        isPaused={isPaused}
        isFinished={isFinished}
        onTogglePause={isWriter && isLive ? () => void togglePause() : undefined}
        onMore={isLive ? () => setIsLeaveOpen(true) : undefined}
      />

      {isLeaveOpen && (
        // MSG-068
        // 디자인 Version02 Live_16: 뒤로 가기·닫기, 안내 칸, [나가기] [계속 참여하기]
        <Dialog
          title="회의 화면에서 나갈까요?"
          description="나가도 다른 참여자와 녹음·전사는 계속돼요. 언제든 다시 들어올 수 있어요."
          onBack={() => setIsLeaveOpen(false)}
          onClose={() => setIsLeaveOpen(false)}
          footer={
            <>
              <Button variant="secondary" size="md" onClick={leaveRoom}>
                나가기
              </Button>
              <Button size="md" onClick={() => setIsLeaveOpen(false)}>
                계속 참여하기
              </Button>
            </>
          }
        >
          <p className={styles.leaveNote}>
            <Icon src={infoIcon} size={SMALL_ICON_SIZE} />
            {isWriter ? '회의를 끝내려면 오른쪽 위 [회의 끝내기]를 눌러 주세요' : '회의는 회의록 작성자가 끝내요'}
          </p>
        </Dialog>
      )}
      {renaming && (
        <Dialog
          title="안건 수정하기"
          onClose={() => setRenaming(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void renameAgenda();
          }}
          footer={
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setRenaming(null)}>
                취소
              </Button>
              <Button type="submit" variant="primary" size="md" disabled={!renaming.title.trim()}>
                저장
              </Button>
            </>
          }
        >
          <TextField
            label="안건"
            value={renaming.title}
            maxLength={AGENDA_TITLE_MAX_LENGTH}
            autoFocus
            onChange={(event) => setRenaming({ ...renaming, title: event.target.value })}
          />
        </Dialog>
      )}
      {deletingAgendaId && (
        <ConfirmDialog
          title="안건을 삭제할까요?"
          message="이 안건으로 나뉜 발언은 '안건 없음'으로 바뀌어요."
          cancelLabel="취소"
          confirmLabel="삭제"
          isDanger
          onCancel={() => setDeletingAgendaId(null)}
          onConfirm={() => void deleteAgenda(deletingAgendaId)}
        />
      )}
      {isOnboarding && isLive && (
        // REQ-174, MSG-075
        <Coachmark
          steps={[
            {
              targetId: 'live-summary-title',
              text: '실시간 요약이 여기에 쌓여요.\n대화가 시작되면 AI가 핵심 의견과 할 일을 자동으로 정리해요.',
            },
            {
              targetId: 'room-side-panel',
              text: '발언이 여기에 실시간으로 받아 적혀요.\n회의록 작성자는 발언을 눌러 바로 고칠 수 있어요.',
            },
            {
              targetId: 'agenda-status-title',
              text: '안건마다 논의 상태를 보여 줘요.\n결정 내용을 누르면 근거가 된 발언을 확인할 수 있어요.',
            },
          ]}
          onFinish={finishOnboarding}
        />
      )}
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
      {isOffTopicOpen && isWriter && isLive && (
        <OffTopicNotice
          onConfirm={dismissNotice}
          onRegister={() => {
            dismissNotice();
            setAddAgendaTitle('');
          }}
        />
      )}
      {shownEndStep && (
        <EndMeetingModal
          // 단계마다 새로 그려 남은 안건 선택을 그 단계의 목록으로 시작한다
          key={shownEndStep}
          step={shownEndStep}
          leftover={leftover ? snapshotAgendas(agendas, leftover) : []}
          summary={todaySummary ? summaryAgendas(agendas, todaySummary) : null}
          carriedIds={carriedIds}
          isBusy={isEndBusy || isEnding}
          onContinue={() => void continueMeeting()}
          onCarryOver={(agendaIds) => void carryOver(agendaIds)}
          onFinish={() => void endMeeting()}
          onChangeDecisionStatus={(agendaId, decisionId, status) => void changeDecisionStatus(agendaId, decisionId, status)}
          onSaveDecision={(decisionId, text) => void saveDecision(decisionId, text)}
          onSaveSummary={(agendaId, item, text) => void saveSummaryItem(agendaId, item, text)}
          onSaveTodo={(agendaId, todo, change) => void saveTodo(agendaId, todo, change)}
        />
      )}
      {viewerEndStep && !isViewerSummaryClosed && (
        <EndMeetingModal
          key={`viewer-${viewerEndStep}`}
          isViewer
          step={viewerEndStep}
          leftover={[]}
          summary={todaySummary ? summaryAgendas(agendas, todaySummary) : null}
          carriedIds={[]}
          isBusy={false}
          onContinue={() => undefined}
          onCarryOver={() => undefined}
          onFinish={() => undefined}
          onClose={() => setIsViewerSummaryClosed(true)}
        />
      )}
    </div>
  );
}
