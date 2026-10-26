import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage, isApiError } from '../../api/client';
import { getLiveSummary, getMeetingDetail, listTranscripts, type MeetingDetailResponse } from '../../api/meeting';
import {
  changeMinutesTemplate,
  downloadMinutes,
  getMinutesByMeeting,
  listMinutesTemplates,
  markMinutesViewed,
  MINUTES_ERROR_CODES,
  saveMinutesSections,
  shareMinutes,
  type ExportFormat,
  type MinutesDetail,
  type MinutesSection,
} from '../../api/minutes';
import { getMe } from '../../api/user';
import Placeholder from '../../components/Placeholder';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { TranscriptLine } from '../../types/meetingRoom';
import type { MinutesTemplate } from '../../types/template';
import { toTime } from '../../utils/calendar';
import { formatMeetingDate } from '../../utils/meetingFormat';
import { toTranscriptLine } from '../meeting/room/roomData';
import DownloadModal from './DownloadModal';
import MinutesDocument from './MinutesDocument';
import MinutesSidePanels from './MinutesSidePanels';
import ShareConfirmModal from './ShareConfirmModal';
import styles from './MinutesEditorPage.module.css';

const META_ICON_SIZE = 20;
const BUTTON_ICON_SIZE = 16;
// MSG-037~040
const SHARED_MESSAGE = '회의록을 저장하고 참석 멤버에게 공유했습니다.';
const SHARE_FAILED_MESSAGE = '회의록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const SAVE_FAILED_MESSAGE = '임시저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const DOWNLOAD_FAILED_MESSAGE = '파일을 다운로드하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const SAVED_MESSAGE = '임시저장했어요.';
const STATUS_LABELS = { WRITING: '작성 중', REVIEWING: '검토 중', CONFIRMED: '확정' } as const;

type LoadState = { type: 'loading' } | { type: 'notReady' } | { type: 'error'; message: string } | { type: 'ready' };

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

/** 회의록·나·양식을 받는다. 처음 여는 작성자에게는 기본 양식으로 칸을 만들어 준다 (AI 초안 REQ-101은 아직) */
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
  const [meeting, setMeeting] = useState<MeetingDetailResponse | null>(null);
  const [templates, setTemplates] = useState<MinutesTemplate[]>([]);
  const [myId, setMyId] = useState<number>();
  const [summary, setSummary] = useState<{ topic: string | null; texts: string[] }>({ topic: null, texts: [] });
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [dialog, setDialog] = useState<'download' | 'share' | null>(searchParams.get('download') ? 'download' : null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  const apply = useCallback((detail: MinutesDetail) => {
    setMinutes(detail);
    setSections(detail.sections);
    setIsDirty(false);
  }, []);

  const load = useCallback(() => {
    let isCurrent = true;
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
        if (isCurrent) {
          setState(
            isApiError(error, MINUTES_ERROR_CODES.notReady)
              ? { type: 'notReady' }
              : { type: 'error', message: errorMessage(error) },
          );
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [id, apply]);

  useEffect(() => load(), [load]);

  useEffect(() => {
    let isCurrent = true;
    getMeetingDetail(id)
      .then(async (detail) => {
        const [transcripts, live] = await Promise.all([listTranscripts(id), getLiveSummary(id).catch(() => null)]);
        if (!isCurrent) {
          return;
        }
        setMeeting(detail);
        setLines(transcripts.map((line) => toTranscriptLine(line, detail.startedAt)).sort((a, b) => a.startMs - b.startMs));
        const items = live?.summary ?? [];
        setSummary({ topic: items.at(-1)?.topic ?? null, texts: items.map(({ text }) => text) });
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [id]);

  if (state.type !== 'ready' || !minutes) {
    return (
      <div className={styles.page}>
        <header className={styles.topBar}>
          <Link to="/home" className={styles.logo}>
            sync
          </Link>
        </header>
        <div className={styles.message}>
          {state.type === 'loading' && <p>회의록을 불러오는 중이에요.</p>}
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
  const meta = [
    scheduleLabel(minutes.meetingStartAt, meeting?.endAt),
    ...(minutes.location ? [minutes.location] : []),
    `참석자 ${minutes.attendees.length}명`,
    templateName ?? '양식 없음',
  ];
  const documentMeta = [
    `일시: ${scheduleLabel(minutes.meetingStartAt, meeting?.endAt)}`,
    ...(minutes.location ? [`장소: ${minutes.location}`] : []),
    `작성자: ${minutes.writer.name}`,
    `참석자: ${minutes.attendees.map(({ name }) => name).join(', ')}`,
  ];

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
      <header className={styles.topBar}>
        <Link to="/home" className={styles.logo}>
          sync
        </Link>
      </header>
      <div className={styles.headBar}>
        <div className={styles.info}>
          <h1 className={styles.title}>{minutes.title}</h1>
          <ul className={styles.meta}>
            {meta.map((item) => (
              <li key={item} className={styles.metaItem}>
                <Placeholder size={META_ICON_SIZE} />
                {item}
              </li>
            ))}
            {minutes.status !== 'WRITING' && <li className={styles.status}>{STATUS_LABELS[minutes.status]}</li>}
          </ul>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => setDialog('download')}>
            <Placeholder size={BUTTON_ICON_SIZE} />
            다운로드
          </button>
          {isWriter && (
            <button type="button" className={styles.secondary} disabled={isSaving} onClick={saveDraft}>
              {/* REQ-135 저장하는 동안 아이콘이 로딩 표시로 바뀐다 */}
              {isSaving ? <span className={styles.spinner} aria-hidden="true" /> : <Placeholder size={BUTTON_ICON_SIZE} />}
              {isSaving ? '저장 중' : '임시저장'}
            </button>
          )}
          {isWriter && minutes.status === 'WRITING' && (
            <button type="button" className={styles.primary} onClick={() => setDialog('share')}>
              <Placeholder size={BUTTON_ICON_SIZE} />
              작성 완료
            </button>
          )}
        </div>
      </div>
      <div className={styles.content}>
        <MinutesDocument
          minutes={minutes}
          sections={sections}
          meta={documentMeta}
          canEdit={isWriter}
          canChangeTemplate={isWriter && minutes.status === 'WRITING'}
          templates={templates}
          onChangeSection={(index, content) => {
            setSections((prev) => prev.map((section, position) => (position === index ? { ...section, content } : section)));
            setIsDirty(true);
          }}
          onChangeTemplate={changeTemplate}
        />
        <MinutesSidePanels topic={summary.topic} summary={summary.texts} lines={lines} />
      </div>
      {dialog === 'download' && <DownloadModal isDownloading={isDownloading} onDownload={download} onClose={closeDialog} />}
      {dialog === 'share' && <ShareConfirmModal isSharing={isSharing} onShare={share} onClose={closeDialog} />}
    </div>
  );
}
