import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { errorMessage, isApiError } from '../../api/client';
import { getAgendaBoard, getMeetingDetail, listTranscripts, type MeetingDetailResponse } from '../../api/meeting';
import {
  changeMinutesTemplate,
  downloadMinutes,
  getMinutesByMeeting,
  markMinutesViewed,
  MINUTES_ERROR_CODES,
  requestMinutesDraft,
  saveMinutesSections,
  shareMinutes,
  type ExportFormat,
  type MinutesDetail,
  type MinutesSection,
} from '../../api/minutes';
import alignCenterIcon from '../../assets/icons/align-center.svg';
import alignLeftIcon from '../../assets/icons/align-left.svg';
import alignRightIcon from '../../assets/icons/align-right.svg';
import bulletIcon from '../../assets/icons/format-bullet.svg';
import boldIcon from '../../assets/icons/format-bold.svg';
import italicIcon from '../../assets/icons/format-italic.svg';
import underlineIcon from '../../assets/icons/format-underline.svg';
import downloadIcon from '../../assets/icons/download.svg';
import locationIcon from '../../assets/icons/location.svg';
import personIcon from '../../assets/icons/participants.svg';
import redoIcon from '../../assets/icons/redo.svg';
import saveIcon from '../../assets/icons/save.svg';
import scheduleIcon from '../../assets/icons/schedule.svg';
import templateIcon from '../../assets/icons/template-doc.svg';
import undoIcon from '../../assets/icons/undo.svg';
import AccessNotice from '../../components/AccessNotice';
import AiNotice from '../../components/AiNotice';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import DropdownMenu from '../../components/DropdownMenu';
import EditorTopBar from '../../components/EditorTopBar';
import editorBar from '../../components/EditorTopBar.module.css';
import Icon from '../../components/Icon';
import Spinner from '../../components/Spinner';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { TranscriptLine } from '../../types/meetingRoom';
import type { MinutesTemplate } from '../../types/template';
import { accessNoticeOf, type AccessNoticeKind } from '../../utils/accessNotice';
import { toTranscriptLine } from '../meeting/room/roomData';
import ActionMenu from '../workspace/ActionMenu';
// 레거시 (2026-11-22, 피그마 프론트는 [다운로드] 아래 형식 메뉴라 막음): 회의록 다운로드 창
// import DownloadModal from './DownloadModal';
import MinutesDocument, { type DocInfo } from './MinutesDocument';
import MinutesSidePanels, { type AgendaSummary } from './MinutesSidePanels';
import { fetchMinutes, scheduleLabel } from './minutesData';
import ShareConfirmModal from './ShareConfirmModal';
import styles from './MinutesEditorPage.module.css';

const META_ICON_SIZE = 16;
const BUTTON_ICON_SIZE = 16;
// 디자인 History: 28px 버튼 안 20px 아이콘
const HISTORY_ICON_SIZE = 20;
// 되돌리기: 이 시간 안에 이어 쓴 글은 한 번에 되돌린다. 너무 길어지지 않게 최근 것만 둔다
const HISTORY_MERGE_MS = 1000;
const HISTORY_LIMIT = 100;
// MSG-037~040
const SHARED_MESSAGE = '넵! 참석자 모두에게 회의록을 공유했어요.';
const SHARE_FAILED_MESSAGE = '회의록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
const SAVE_FAILED_MESSAGE = '임시저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
const DOWNLOAD_FAILED_MESSAGE = '파일을 다운로드하지 못했어요. 잠시 후 다시 시도해 주세요.';
const SAVED_MESSAGE = '임시저장했어요.';
const EDITED_MESSAGE = '고친 내용을 저장하고 참석자에게 알렸어요.';
const DRAFT_FILLED_MESSAGE = 'AI 초안으로 비어 있던 칸을 채웠어요.';
// MSG-055~057 (REQ-101, REQ-161)
const DRAFTING_MESSAGE = 'AI 초안을 만들고 있어요. 완성되면 비어 있는 칸에 채워 드려요.';
const DRAFT_FAILED_MESSAGE = 'AI 초안을 만들지 못했어요. [다시 만들기]를 눌러 다시 시도해 주세요.';
const DRAFT_RETRY_FAILED_MESSAGE = 'AI 초안을 다시 요청하지 못했어요. 잠시 후 다시 시도해 주세요.';
// REQ-101 AI 초안이 오는지 보는 간격과 횟수. 서버가 오늘 회의 요약을 최대 10분 기다렸다가 요청하므로 12분까지 본다
const DRAFT_POLL_MS = 3000;
const DRAFT_POLL_MAX = 240;
const DRAFTING_STATUSES: ReadonlyArray<MinutesDetail['draftStatus']> = ['WAITING_SOURCE', 'REQUESTED'];
// 회의를 마무리하면 회의록이 Kafka로 비동기 생성된다. 그동안 1.5초마다 다시 불러온다 (최대 약 30초)
const NOT_READY_RETRY_MS = 1500;
const NOT_READY_MAX_RETRIES = 20;
const STATUS_LABELS = { WRITING: '작성 중', REVIEWING: '검토 중', CONFIRMED: '확정' } as const;

type FormatAction = { label: string; command: string; icon?: string; text?: string; textClass?: string } | 'divider';

const FORMAT_ACTIONS: FormatAction[] = [
  // 디자인 DocEditToolbar: 글자 대신 아이콘 (디자인 체크 2026-11-19)
  { label: '굵게', command: 'bold', icon: boldIcon },
  { label: '기울임', command: 'italic', icon: italicIcon },
  { label: '밑줄', command: 'underline', icon: underlineIcon },
  'divider',
  { label: '글머리 기호', command: 'insertUnorderedList', icon: bulletIcon },
  'divider',
  { label: '왼쪽 정렬', command: 'justifyLeft', icon: alignLeftIcon },
  { label: '가운데 정렬', command: 'justifyCenter', icon: alignCenterIcon },
  { label: '오른쪽 정렬', command: 'justifyRight', icon: alignRightIcon },
];

type LoadState =
  | { type: 'loading' }
  | { type: 'notReady' }
  | { type: 'error'; message: string }
  | { type: 'access'; notice: AccessNoticeKind }
  | { type: 'ready' };

/** 칸 구성(양식)이 같은지. 다르면 되돌리기 기록을 지운다 (양식을 바꾼 뒤 예전 칸으로 되돌리지 않게) */
function sameShape(a: MinutesSection[], b: MinutesSection[]) {
  return a.length === b.length && a.every((section, index) => section.sectionId === b[index].sectionId);
}

/** 서버 오류 메시지가 있으면 그것을, 아니면 화면 문구를 보여 준다 */
function failMessage(error: unknown, fallback: string) {
  return isApiError(error) && error.status !== 0 && error.status < 500 ? errorMessage(error) : fallback;
}

/** REQ-131~137, 140 회의록 작성 화면 (Figma 23-2 회의록 편집 및 공유) */
export default function MinutesEditorPage() {
  const { meetingId } = useParams();
  // 레거시 (2026-11-22, 피그마 프론트는 [다운로드] 아래 형식 메뉴라 막음): 회의록 다운로드 창
  // const [searchParams] = useSearchParams();
  const id = Number(meetingId);
  const [state, setState] = useState<LoadState>({ type: 'loading' });
  const [minutes, setMinutes] = useState<MinutesDetail | null>(null);
  const [sections, setSections] = useState<MinutesSection[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  // 초안을 기다리는 동안 저장하지 않은 수정이 있는지 (기다리는 타이머 안에서 읽는다)
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);
  const [meeting, setMeeting] = useState<MeetingDetailResponse | null>(null);
  const [templates, setTemplates] = useState<MinutesTemplate[]>([]);
  const [myId, setMyId] = useState<number>();
  const [agendaSummaries, setAgendaSummaries] = useState<AgendaSummary[]>([]);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRetryingDraft, setIsRetryingDraft] = useState(false);
  // 레거시 (2026-11-22, 피그마 프론트는 [다운로드] 아래 형식 메뉴라 막음): 회의록 다운로드 창. 아카이브에서 오던 ?download=1도 받지 않는다
  // const [dialog, setDialog] = useState<'download' | 'share' | null>(searchParams.get('download') ? 'download' : null);
  const [dialog, setDialog] = useState<'share' | null>(null);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  // 서식은 줄글 칸(RichTextField)에만 넣을 수 있다. 커서가 그 칸에 있을 때만 서식 버튼을 켠다
  const [canFormat, setCanFormat] = useState(false);
  useEffect(() => {
    const update = () => {
      const node = document.getSelection()?.anchorNode;
      const element = node instanceof Element ? node : node?.parentElement;
      setCanFormat(Boolean(element?.closest('[contenteditable="true"]')));
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, []);
  // 디자인 Version02: 양식을 고르면 바꾸기 전에 한 번 묻는다 / 다운로드는 상단 바 아래 작은 메뉴
  const [pendingTemplate, setPendingTemplate] = useState<{ templateId: number; name: string } | null>(null);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadAnchorRef = useRef<HTMLButtonElement>(null);
  // 디자인 History: 되돌리기, 다시 실행 (작성자, 작성 중)
  const [past, setPast] = useState<MinutesSection[][]>([]);
  const [future, setFuture] = useState<MinutesSection[][]>([]);
  const lastEditAtRef = useRef(0);
  const templateAnchorRef = useRef<HTMLButtonElement>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  const apply = useCallback((detail: MinutesDetail) => {
    setMinutes(detail);
    setSections((prev) => {
      if (!sameShape(prev, detail.sections)) {
        setPast([]);
        setFuture([]);
      }
      return detail.sections;
    });
    setIsDirty(false);
  }, []);

  const load = useCallback(() => {
    let isCurrent = true;
    let retries = 0;
    let retryTimer: number | undefined;
    const attempt = () =>
      fetchMinutes(id)
        .then(({ detail, myUserId, templateList }) => {
          if (isCurrent) {
            setMyId(myUserId);
            setTemplates(templateList);
            apply(detail);
            setState({ type: 'ready' });
            markMinutesViewed(detail.minutesId).catch(() => undefined);
          }
        })
        .catch((error: unknown) => {
          if (!isCurrent) {
            return;
          }
          if (isApiError(error, MINUTES_ERROR_CODES.notReady) && retries < NOT_READY_MAX_RETRIES) {
            retries += 1;
            retryTimer = window.setTimeout(attempt, NOT_READY_RETRY_MS);
            return;
          }
          if (isApiError(error, MINUTES_ERROR_CODES.notReady)) {
            setState({ type: 'notReady' });
            return;
          }
          // REQ-205, 206 권한 없는 링크, 삭제된 회의록 링크. 회의록이 없으면 회의가 삭제됐는지 회의 쪽에 물어본다
          const notice = accessNoticeOf(error);
          if (notice || !isApiError(error) || error.status !== 404) {
            setState(notice ? { type: 'access', notice } : { type: 'error', message: errorMessage(error) });
            return;
          }
          getMeetingDetail(id)
            .then(() => isCurrent && setState({ type: 'error', message: errorMessage(error) }))
            .catch((meetingError: unknown) => {
              if (isCurrent) {
                const meetingNotice = accessNoticeOf(meetingError);
                setState(meetingNotice ? { type: 'access', notice: meetingNotice } : { type: 'error', message: errorMessage(error) });
              }
            });
        });
    attempt();
    return () => {
      isCurrent = false;
      window.clearTimeout(retryTimer);
    };
  }, [id, apply]);

  useEffect(() => load(), [load]);

  // REQ-101 AI 초안이 만들어지는 동안 다시 받아, 서버가 채운 칸을 화면에 넣는다.
  // 저장하지 않은 수정이 없으면 서버 칸 그대로 (REQ-140 양식을 바꾼 뒤의 다시 배치는 서버가 모든 칸을 바꾼다).
  // 수정이 있으면 서버가 비어 있던 칸만 채우므로 화면에서도 비어 있는 칸만 바꾸고, 그사이 쓴 글은 그대로 둔다
  const isDrafting = DRAFTING_STATUSES.includes(minutes?.draftStatus ?? null);
  useEffect(() => {
    if (!isDrafting) {
      return undefined;
    }
    let polls = 0;
    const timerId = window.setInterval(() => {
      polls += 1;
      if (polls > DRAFT_POLL_MAX) {
        window.clearInterval(timerId);
        return;
      }
      getMinutesByMeeting(id)
        .then((latest) => {
          if (DRAFTING_STATUSES.includes(latest.draftStatus)) {
            return;
          }
          window.clearInterval(timerId);
          if (!isDirtyRef.current) {
            apply(latest);
          } else {
            // 다음 저장이 거절되지 않게 version은 서버 값으로 맞춘다
            setMinutes(latest);
            const filled = new Map(latest.sections.map((section) => [section.sectionId, section.content]));
            setSections((prev) =>
              prev.map((section) =>
                section.content.trim()
                  ? section
                  : { ...section, content: filled.get(section.sectionId) ?? section.content, richContent: null },
              ),
            );
          }
          if (latest.draftStatus === 'SUCCEEDED' && latest.sections.some(({ content }) => content.trim())) {
            setToast({ text: DRAFT_FILLED_MESSAGE, variant: 'info' });
          }
        })
        .catch(() => undefined);
    }, DRAFT_POLL_MS);
    return () => window.clearInterval(timerId);
  }, [id, isDrafting, apply]);

  useEffect(() => {
    let isCurrent = true;
    getMeetingDetail(id)
      .then(async (detail) => {
        const [transcripts, board] = await Promise.all([listTranscripts(id), getAgendaBoard(id).catch(() => null)]);
        if (!isCurrent) {
          return;
        }
        setMeeting(detail);
        setLines(transcripts.map((line) => toTranscriptLine(line)).sort((a, b) => a.startMs - b.startMs));
        // REQ-133 회의가 끝난 뒤 오늘 회의 요약(마지막 값)이 있으면 그것을, 없으면 마지막 안건 보드의 안건 요약
        const boardAgendas = board?.todaySummary?.agendas ?? board?.agendas ?? [];
        const byId = new Map(boardAgendas.map((agenda) => [agenda.agendaId, agenda]));
        setAgendaSummaries(
          detail.agendas.map(({ agendaId, title, decisionPoints }) => ({
            id: String(agendaId),
            title,
            status: byId.get(agendaId)?.status,
            // 디자인 Version02 결정현황: 안건의 결정할 사항마다 보드의 상태·결정 내용·근거
            decisions: decisionPoints.map(({ decisionPointId, text }) => {
              const point = byId.get(agendaId)?.decisionPoints?.find((one) => one.decisionPointId === decisionPointId);
              return {
                id: String(decisionPointId),
                title: text,
                status: point?.status ?? 'NOT_STARTED',
                text: point?.decisionText ?? '',
                evidenceSeqs: point?.evidenceSeqs ?? [],
              };
            }),
            openIssues: (byId.get(agendaId)?.opinions ?? [])
              .filter(({ kind }) => kind === 'CONCERN' || kind === 'QUESTION')
              .map(({ text }) => text),
            summary: (byId.get(agendaId)?.summary ?? []).map(({ text }) => text),
            // 주요 의견: 우려·질문(아직 합의되지 않은 부분)은 빼고 의견·근거만
            opinions: (byId.get(agendaId)?.opinions ?? [])
              .filter(({ kind }) => kind !== 'CONCERN' && kind !== 'QUESTION')
              .map(({ text }) => text),
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [id]);

  if (state.type === 'access') {
    return (
      <div className={styles.page}>
        <EditorTopBar />
        <AccessNotice kind={state.notice} />
      </div>
    );
  }
  if (state.type !== 'ready' || !minutes) {
    return (
      <div className={styles.page}>
        <EditorTopBar />
        <div className={styles.message}>
          {state.type === 'loading' && <p>회의록을 준비하고 있어요. 잠시만 기다려 주세요.</p>}
          {state.type === 'notReady' && (
            <>
              <p>회의록을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.</p>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  setState({ type: 'loading' });
                  load();
                }}
              >
                다시 불러오기
              </button>
            </>
          )}
          {state.type === 'error' && <p>{state.message}</p>}
        </div>
      </div>
    );
  }

  const isWriter = minutes.writer.userId === myId;
  const templateName = templates.find((template) => template.templateId === minutes.templateId)?.name;
  const isEditing = isWriter && minutes.status === 'WRITING';
  const meta = [
    { icon: scheduleIcon, label: scheduleLabel(minutes.meetingStartAt, meeting?.endAt) },
    ...(minutes.location ? [{ icon: locationIcon, label: minutes.location }] : []),
    { icon: personIcon, label: `참석자 ${minutes.attendees.length}명` },
    // 디자인 Meta_Template: "기본 회의록 양식"처럼 양식 이름 뒤에 "양식"
    { icon: templateIcon, label: templateName ? (templateName.endsWith('양식') ? templateName : `${templateName} 양식`) : '양식 없음' },
  ];
  // 디자인 DocInfoList: 일시, 장소, 참석자
  const documentInfo: DocInfo[] = [
    { label: '일시', value: scheduleLabel(minutes.meetingStartAt, meeting?.endAt) },
    ...(minutes.location ? [{ label: '장소', value: minutes.location }] : []),
    {
      label: '참석자',
      value: `${minutes.attendees.map(({ name }) => name).join(', ')} (${minutes.attendees.length}명)`,
    },
  ];

  const changeSection = (index: number, content: string, richContent: string | null) => {
    const now = Date.now();
    if (now - lastEditAtRef.current > HISTORY_MERGE_MS) {
      setPast((prev) => [...prev, sections].slice(-HISTORY_LIMIT));
      setFuture([]);
    }
    lastEditAtRef.current = now;
    setSections((prev) =>
      prev.map((section, position) => (position === index ? { ...section, content, richContent } : section)),
    );
    setIsDirty(true);
  };

  const undo = () => {
    const previous = past.at(-1);
    if (!previous) {
      return;
    }
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [sections, ...prev]);
    setSections(previous);
    setIsDirty(true);
    lastEditAtRef.current = 0;
  };

  const redo = () => {
    const [next, ...rest] = future;
    if (!next) {
      return;
    }
    setFuture(rest);
    setPast((prev) => [...prev, sections]);
    setSections(next);
    setIsDirty(true);
    lastEditAtRef.current = 0;
  };

  const save = async () => {
    const saved = await saveMinutesSections(minutes.minutesId, minutes.version, sections);
    apply(saved);
    return saved;
  };

  const saveDraft = async () => {
    setIsSaving(true);
    try {
      await save();
      setToast({ text: SAVED_MESSAGE, variant: 'info' });
    } catch (error) {
      setToast({ text: failMessage(error, SAVE_FAILED_MESSAGE), variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // REQ-111 공유한 회의록을 고친 뒤 저장 (서버가 참석자에게 알린다)
  const finishEdit = async () => {
    setIsSaving(true);
    try {
      await save();
      setToast({ text: EDITED_MESSAGE, variant: 'info' });
    } catch (error) {
      setToast({ text: failMessage(error, SAVE_FAILED_MESSAGE), variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const share = async () => {
    setIsSharing(true);
    try {
      const saved = isDirty ? await save() : minutes;
      await shareMinutes(saved.minutesId);
      apply(await getMinutesByMeeting(id));
      setDialog(null);
      setToast({ text: SHARED_MESSAGE, variant: 'info' });
    } catch (error) {
      setToast({ text: failMessage(error, SHARE_FAILED_MESSAGE), variant: 'error' });
    } finally {
      setIsSharing(false);
    }
  };

  const download = async (format: ExportFormat) => {
    setIsDownloading(true);
    try {
      // 저장하지 않은 내용은 파일에 들어가지 않으므로 먼저 저장한다
      if (isWriter && isDirty) {
        await save();
      }
      await downloadMinutes(minutes.minutesId, format);
      setDialog(null);
    } catch (error) {
      setToast({ text: failMessage(error, DOWNLOAD_FAILED_MESSAGE), variant: 'error' });
    } finally {
      setIsDownloading(false);
    }
  };

  // REQ-161 서버가 비어 있는 칸만 채우므로, 쓰던 글을 먼저 저장해 두어 AI가 덮지 않게 한다
  const retryDraft = async () => {
    setIsRetryingDraft(true);
    try {
      if (isDirty) {
        await save();
      }
      apply(await requestMinutesDraft(minutes.minutesId));
    } catch (error) {
      if (isApiError(error, MINUTES_ERROR_CODES.draftInProgress)) {
        apply(await getMinutesByMeeting(id).catch(() => minutes));
        return;
      }
      setToast({ text: failMessage(error, DRAFT_RETRY_FAILED_MESSAGE), variant: 'error' });
    } finally {
      setIsRetryingDraft(false);
    }
  };
  const showDraftNotice = isWriter && minutes.status === 'WRITING';

  const changeTemplate = async (templateId: number) => {
    if (templateId === minutes.templateId) {
      return;
    }
    try {
      if (isDirty) {
        await save();
      }
      apply(await changeMinutesTemplate(minutes.minutesId, templateId));
    } catch (error) {
      setToast({ text: errorMessage(error), variant: 'error' });
    }
  };

  return (
    <div className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <EditorTopBar
        left={
          isEditing && (
            <div className={styles.history}>
              <button type="button" className={styles.historyButton} aria-label="되돌리기" disabled={past.length === 0} onClick={undo}>
                <Icon src={undoIcon} size={HISTORY_ICON_SIZE} />
              </button>
              <button type="button" className={styles.historyButton} aria-label="다시 실행" disabled={future.length === 0} onClick={redo}>
                <Icon src={redoIcon} size={HISTORY_ICON_SIZE} />
              </button>
            </div>
          )
        }
        actions={
          <>
            {/* 디자인 Version02: 다운로드는 상단 바 오른쪽, 임시저장 앞 */}
            <span className={styles.anchor}>
              <button
                ref={downloadAnchorRef}
                type="button"
                className={[editorBar.action, styles.downloadAction, isDownloadMenuOpen ? styles.downloadOpen : ''].filter(Boolean).join(' ')}
                aria-haspopup="menu"
                aria-expanded={isDownloadMenuOpen}
                disabled={isDownloading}
                onClick={() => setIsDownloadMenuOpen((open) => !open)}
              >
                {isDownloading ? <Spinner size={BUTTON_ICON_SIZE} /> : <Icon src={downloadIcon} size={BUTTON_ICON_SIZE} />}
                다운로드
              </button>
              {isDownloadMenuOpen && (
                <ActionMenu
                  label="다운로드 형식"
                  anchorRef={downloadAnchorRef}
                  className={styles.downloadMenu}
                  items={[
                    { label: 'PDF로 다운로드', onSelect: () => void download('PDF') },
                    { label: 'Word (.docx)로 다운로드', onSelect: () => void download('DOCX') },
                  ].map((item) => ({
                    ...item,
                    onSelect: () => {
                      setIsDownloadMenuOpen(false);
                      item.onSelect();
                    },
                  }))}
                  onClose={() => setIsDownloadMenuOpen(false)}
                />
              )}
            </span>
            {isWriter && (
              <button
                type="button"
                className={`${editorBar.action} ${editorBar.secondary}`}
                // REQ-101 AI 초안을 만드는 동안은 [임시저장], [작성 완료]를 끈다 (다 되거나 실패하면 다시 켜진다)
                disabled={isSaving || isDrafting}
                onClick={saveDraft}
              >
                {/* REQ-135 저장하는 동안 아이콘이 로딩 표시로 바뀐다 */}
                {isSaving ? <Spinner size={BUTTON_ICON_SIZE} /> : <Icon src={saveIcon} size={BUTTON_ICON_SIZE} />}
                {isSaving ? '저장 중' : '임시저장'}
              </button>
            )}
            {isWriter && minutes.status === 'WRITING' && (
              <button
                type="button"
                className={`${editorBar.action} ${editorBar.primary}`}
                disabled={isDrafting}
                onClick={() => setDialog('share')}
              >
                작성 완료
              </button>
            )}
            {/* 디자인 체크 2026-11-19: 공유한 뒤에도 고치면 [수정 완료]가 나온다. 저장하면 참석자에게 알림 (REQ-111) */}
            {isWriter && minutes.status !== 'WRITING' && (
              <button
                type="button"
                className={`${editorBar.action} ${editorBar.primary}`}
                disabled={!isDirty || isSaving}
                onClick={finishEdit}
              >
                수정 완료
              </button>
            )}
          </>
        }
      />
      {/* 디자인 MeetingInfoBar */}
      <div className={styles.headBar}>
        <h1 className={styles.title}>{minutes.title}</h1>
        <ul className={styles.meta}>
          {meta.map((item) => (
            <li key={item.label} className={styles.metaItem}>
              <Icon src={item.icon} size={META_ICON_SIZE} className={styles.metaIcon} />
              {item.label}
            </li>
          ))}
          {minutes.status !== 'WRITING' && <li className={styles.status}>{STATUS_LABELS[minutes.status]}</li>}
          {/* REQ-140 디자인 ChangeTemplateButton (작성자, 작성 중) */}
          {isEditing && (
            <li className={styles.anchor}>
              <button
                ref={templateAnchorRef}
                type="button"
                className={styles.changeTemplate}
                aria-haspopup="listbox"
                aria-expanded={isTemplateMenuOpen}
                onClick={() => setIsTemplateMenuOpen((open) => !open)}
              >
                변경
              </button>
              {isTemplateMenuOpen && (
                <DropdownMenu
                  label="회의록 양식"
                  emptyText="양식이 없어요"
                  anchorRef={templateAnchorRef}
                  className={styles.templateMenu}
                  items={templates.map((template) => ({
                    id: String(template.templateId),
                    label: template.name,
                    isSelected: template.templateId === minutes.templateId,
                  }))}
                  onSelect={(templateId) => {
                    setIsTemplateMenuOpen(false);
                    const picked = templates.find((template) => template.templateId === Number(templateId));
                    if (picked && picked.templateId !== minutes.templateId) {
                      setPendingTemplate({ templateId: picked.templateId, name: picked.name });
                    }
                  }}
                  onClose={() => setIsTemplateMenuOpen(false)}
                />
              )}
            </li>
          )}
        </ul>
      </div>
      {/* 디자인 Version02 서식 도구 막대 (REQ-194). 줄글 칸에서 고른 글자에 서식을 넣고 저장한다. 서버에서 서식 기능을 끄면 숨긴다 */}
      {isWriter && minutes.richText && (
        <div className={styles.formatBar} role="toolbar" aria-label="서식">
          {FORMAT_ACTIONS.map((action, index) =>
            action === 'divider' ? (
              <span key={index} className={styles.formatDivider} aria-hidden="true" />
            ) : (
              <button
                key={action.label}
                type="button"
                className={styles.formatButton}
                aria-label={action.label}
                disabled={!canFormat}
                onMouseDown={(event) => {
                  // 누르는 동안 문서 칸의 선택이 풀리지 않게
                  event.preventDefault();
                  document.execCommand(action.command);
                }}
              >
                {action.icon ? <Icon src={action.icon} size={BUTTON_ICON_SIZE} /> : <span className={action.textClass}>{action.text}</span>}
              </button>
            ),
          )}
        </div>
      )}
      {/* 디자인 Workspace: 문서(CanvasArea) + 요약, 전사(SummaryTranscriptPanel) */}
      <div className={styles.workspace}>
        <MinutesDocument
          minutes={minutes}
          sections={sections}
          info={documentInfo}
          canEdit={isWriter}
          templates={templates}
          notice={
            <div className={styles.notices}>
              {showDraftNotice && isDrafting && (
                <p className={styles.draftNotice} role="status">
                  <Spinner size={BUTTON_ICON_SIZE} />
                  {DRAFTING_MESSAGE}
                </p>
              )}
              {showDraftNotice && minutes.draftStatus === 'FAILED' && (
                <div className={`${styles.draftNotice} ${styles.draftFailed}`} role="alert">
                  <span>{DRAFT_FAILED_MESSAGE}</span>
                  <button type="button" className={styles.secondary} disabled={isRetryingDraft} onClick={retryDraft}>
                    {isRetryingDraft && <Spinner size={BUTTON_ICON_SIZE} />}
                    다시 만들기
                  </button>
                </div>
              )}
              {/* REQ-175 초안이 준비되면 작성자에게 (MSG-071), 다른 참석자에게는 작성자가 정리 중이라고 (MSG-072) */}
              {minutes.status === 'WRITING' && minutes.draftStatus === 'SUCCEEDED' && isWriter && (
                <p className={`${styles.draftNotice} ${styles.draftReady}`} role="status">
                  회의록 초안이 준비됐어요. 내가 다듬고 [작성 완료]를 누르면 참여자 모두에게 공개돼요.
                </p>
              )}
              {minutes.status === 'WRITING' && !isWriter && (
                <p className={styles.draftNotice} role="status">
                  작성자가 회의록을 정리하고 있어요. 완료되면 알림으로 알려 드릴게요.
                </p>
              )}
              {/* REQ-172 AI가 만든 초안 위 안내 (MSG-070) */}
              {minutes.draftStatus === 'SUCCEEDED' && (
                <div className={styles.aiNotice}>
                  <AiNotice meetingId={minutes.meetingId} target="MINUTES_DRAFT" />
                </div>
              )}
            </div>
          }
          onChangeSection={changeSection}
        />
        <MinutesSidePanels agendas={agendaSummaries} lines={lines} />
      </div>
      {pendingTemplate && (
        <Dialog
          title={`'${pendingTemplate.name}' 양식으로 바꿀까요?`}
          description="회의록 내용이 새 양식의 항목에 맞춰 다시 정리돼요. 새 양식에 없는 항목의 내용은 빠질 수 있어요."
          onBack={() => setPendingTemplate(null)}
          onClose={() => setPendingTemplate(null)}
          hideClose
          footer={
            <>
              <Button variant="secondary" size="md" onClick={() => setPendingTemplate(null)}>
                취소
              </Button>
              <Button
                size="md"
                onClick={() => {
                  const { templateId } = pendingTemplate;
                  setPendingTemplate(null);
                  void changeTemplate(templateId);
                }}
              >
                양식 변경
              </Button>
            </>
          }
        />
      )}
      {/* 레거시 (2026-11-22, 피그마 프론트는 [다운로드] 아래 형식 메뉴라 막음): 회의록 다운로드 창
      {dialog === 'download' && <DownloadModal isDownloading={isDownloading} onDownload={download} onClose={closeDialog} />}
      */}
      {dialog === 'share' && <ShareConfirmModal isSharing={isSharing} onShare={share} onClose={closeDialog} />}
    </div>
  );
}
