import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { errorMessage, isApiError } from '../../api/client';
import { getAgendaBoard, getMeetingDetail, listTranscripts, type MeetingDetailResponse } from '../../api/meeting';
import {
  changeMinutesTemplate,
  downloadMinutes,
  getMinutesByMeeting,
  listMinutesTemplates,
  markMinutesViewed,
  MINUTES_ERROR_CODES,
  requestMinutesDraft,
  saveMinutesSections,
  shareMinutes,
  type ExportFormat,
  type MinutesDetail,
  type MinutesSection,
} from '../../api/minutes';
import { getMe } from '../../api/user';
import chevronDownIcon from '../../assets/icons/chevron-down.svg';
import downloadIcon from '../../assets/icons/download.svg';
import locationIcon from '../../assets/icons/location.svg';
import personIcon from '../../assets/icons/person-sm.svg';
import redoIcon from '../../assets/icons/redo.svg';
import saveIcon from '../../assets/icons/save.svg';
import scheduleIcon from '../../assets/icons/schedule.svg';
import templateIcon from '../../assets/icons/template-sm.svg';
import undoIcon from '../../assets/icons/undo.svg';
import AiNotice from '../../components/AiNotice';
import DropdownMenu from '../../components/DropdownMenu';
import EditorTopBar from '../../components/EditorTopBar';
import editorBar from '../../components/EditorTopBar.module.css';
import Icon from '../../components/Icon';
import Spinner from '../../components/Spinner';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { TranscriptLine } from '../../types/meetingRoom';
import type { MinutesTemplate } from '../../types/template';
import { toTime } from '../../utils/calendar';
import { formatMeetingDate } from '../../utils/meetingFormat';
import { toTranscriptLine } from '../meeting/room/roomData';
import DownloadModal from './DownloadModal';
import MinutesDocument, { type DocInfo } from './MinutesDocument';
import MinutesSidePanels, { type AgendaSummary } from './MinutesSidePanels';
import ShareConfirmModal from './ShareConfirmModal';
import styles from './MinutesEditorPage.module.css';

const META_ICON_SIZE = 16;
const BUTTON_ICON_SIZE = 16;
const HISTORY_ICON_SIZE = 24;
// 되돌리기: 이 시간 안에 이어 쓴 글은 한 번에 되돌린다. 너무 길어지지 않게 최근 것만 둔다
const HISTORY_MERGE_MS = 1000;
const HISTORY_LIMIT = 100;
// MSG-037~040
const SHARED_MESSAGE = '회의록을 저장하고 참석 멤버에게 공유했습니다.';
const SHARE_FAILED_MESSAGE = '회의록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const SAVE_FAILED_MESSAGE = '임시저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const DOWNLOAD_FAILED_MESSAGE = '파일을 다운로드하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const SAVED_MESSAGE = '임시저장했어요.';
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

type LoadState = { type: 'loading' } | { type: 'notReady' } | { type: 'error'; message: string } | { type: 'ready' };

/** 칸 구성(양식)이 같은지. 다르면 되돌리기 기록을 지운다 (양식을 바꾼 뒤 예전 칸으로 되돌리지 않게) */
function sameShape(a: MinutesSection[], b: MinutesSection[]) {
  return a.length === b.length && a.every((section, index) => section.sectionId === b[index].sectionId);
}

/** 2026-10-29T14:00 ~ 15:00 → 2026. 10.29 (화) 14:00 - 15:00 (디자인 23:588) */
function scheduleLabel(startAt: string, endAt?: string) {
  const [date, weekday] = formatMeetingDate(startAt.slice(0, 10)).split('(');
  const [year, ...rest] = date.split('.');
  const range = endAt ? `${toTime(startAt)} - ${toTime(endAt)}` : toTime(startAt);
  return `${year}. ${rest.join('.')} (${weekday} ${range}`;
}

/** 서버 오류 메시지가 있으면 그것을, 아니면 화면 문구를 보여 준다 */
function failMessage(error: unknown, fallback: string) {
  return isApiError(error) && error.status !== 0 && error.status < 500 ? errorMessage(error) : fallback;
}

/** 회의록·나·양식을 받는다. 처음 여는 작성자에게는 기본 양식으로 칸을 만들어 준다 (그러면 서버가 AI 초안을 요청한다, REQ-101) */
async function fetchMinutes(meetingId: number) {
  const [detail, me, templateList] = await Promise.all([getMinutesByMeeting(meetingId), getMe(), listMinutesTemplates()]);
  const defaultTemplate = templateList.find((template) => template.isDefault);
  const needsTemplate =
    detail.writer.userId === me.userId &&
    detail.status === 'WRITING' &&
    detail.templateId === null &&
    detail.sections.length === 0;
  return {
    detail:
      needsTemplate && defaultTemplate ? await changeMinutesTemplate(detail.minutesId, defaultTemplate.templateId) : detail,
    myUserId: me.userId,
    templateList,
  };
}

/** REQ-131~137, 140 회의록 작성 화면 (Figma 23-2 회의록 편집 및 공유) */
export default function MinutesEditorPage() {
  const { meetingId } = useParams();
  const [searchParams] = useSearchParams();
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
  const [dialog, setDialog] = useState<'download' | 'share' | null>(searchParams.get('download') ? 'download' : null);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
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
          setState(
            isApiError(error, MINUTES_ERROR_CODES.notReady)
              ? { type: 'notReady' }
              : { type: 'error', message: errorMessage(error) },
          );
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
                section.content.trim() ? section : { ...section, content: filled.get(section.sectionId) ?? section.content },
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
          detail.agendas.map(({ agendaId, title }) => ({
            id: String(agendaId),
            title,
            summary: (byId.get(agendaId)?.summary ?? []).map(({ text }) => text),
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [id]);

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
    { icon: templateIcon, label: templateName ?? '양식 없음' },
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

  const changeSection = (index: number, content: string) => {
    const now = Date.now();
    if (now - lastEditAtRef.current > HISTORY_MERGE_MS) {
      setPast((prev) => [...prev, sections].slice(-HISTORY_LIMIT));
      setFuture([]);
    }
    lastEditAtRef.current = now;
    setSections((prev) => prev.map((section, position) => (position === index ? { ...section, content } : section)));
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
            {isWriter && (
              <button
                type="button"
                className={`${editorBar.action} ${editorBar.secondary}`}
                disabled={isSaving}
                onClick={saveDraft}
              >
                {/* REQ-135 저장하는 동안 아이콘이 로딩 표시로 바뀐다 */}
                {isSaving ? <Spinner size={BUTTON_ICON_SIZE} /> : <Icon src={saveIcon} size={BUTTON_ICON_SIZE} />}
                {isSaving ? '저장 중' : '임시저장'}
              </button>
            )}
            {isWriter && minutes.status === 'WRITING' && (
              <button type="button" className={`${editorBar.action} ${editorBar.primary}`} onClick={() => setDialog('share')}>
                작성 완료
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
                회의록 양식 변경
                <Icon src={chevronDownIcon} size={BUTTON_ICON_SIZE} />
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
                    description: template.items.map(({ title }) => title).join(', '),
                    isSelected: template.templateId === minutes.templateId,
                  }))}
                  onSelect={(templateId) => {
                    setIsTemplateMenuOpen(false);
                    void changeTemplate(Number(templateId));
                  }}
                  onClose={() => setIsTemplateMenuOpen(false)}
                />
              )}
            </li>
          )}
        </ul>
        <button type="button" className={styles.download} onClick={() => setDialog('download')}>
          <Icon src={downloadIcon} size={BUTTON_ICON_SIZE} />
          다운로드
        </button>
      </div>
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
      {dialog === 'download' && <DownloadModal isDownloading={isDownloading} onDownload={download} onClose={closeDialog} />}
      {dialog === 'share' && <ShareConfirmModal isSharing={isSharing} onShare={share} onClose={closeDialog} />}
    </div>
  );
}
