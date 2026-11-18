import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, isApiError } from '../../api/client';
import {
  downloadMinutes,
  markMinutesViewed,
  MINUTES_ERROR_CODES,
  requestMinutesDraft,
  type ExportFormat,
  type MinutesDetail,
} from '../../api/minutes';
import checkIcon from '../../assets/icons/check-sm.svg';
import downloadIcon from '../../assets/icons/download.svg';
import editIcon from '../../assets/icons/edit.svg';
import errorIcon from '../../assets/icons/error.svg';
import locationIcon from '../../assets/icons/location.svg';
import refreshIcon from '../../assets/icons/refresh.svg';
import scheduleIcon from '../../assets/icons/schedule.svg';
import Icon from '../../components/Icon';
import Spinner from '../../components/Spinner';
import type { Meeting } from '../../types/meeting';
import type { MinutesTemplate } from '../../types/template';
import { formatMeetingSchedule, formatShortDateTime } from '../../utils/meetingFormat';
import MinutesDocument, { type DocInfo } from '../minutes/MinutesDocument';
import { fetchMinutes, scheduleLabel } from '../minutes/minutesData';
import ActionMenu from '../workspace/ActionMenu';
import styles from './MinutesCheck.module.css';

const ICON_SIZE = 16;
const BUTTON_ICON_SIZE = 20;
// 초안을 만드는 동안은 자주, 작성자가 정리하는 동안은 가끔 다시 불러온다 (작성 완료되면 문서로 바뀐다)
const DRAFT_POLL_MS = 5000;
const WRITING_POLL_MS = 15000;
const DRAFTING_STATUSES: ReadonlyArray<MinutesDetail['draftStatus']> = ['WAITING_SOURCE', 'REQUESTED'];
// MSG-040, MSG-057
const DOWNLOAD_FAILED_MESSAGE = '파일을 다운로드하지 못했어요. 잠시 후 다시 시도해 주세요.';
const DRAFT_RETRY_FAILED_MESSAGE = 'AI 초안을 다시 요청하지 못했어요. 잠시 후 다시 시도해 주세요.';

type StepState = 'done' | 'active' | 'failed' | 'waiting';

function Step({ index, state, title, caption }: { index: number; state: StepState; title: string; caption: string }) {
  return (
    <li className={styles.step}>
      <span className={`${styles.stepMark} ${styles[state]}`}>
        {state === 'done' && <Icon src={checkIcon} size={ICON_SIZE} />}
        {state === 'active' && <Spinner size={ICON_SIZE} />}
        {state === 'failed' && <Icon src={errorIcon} size={ICON_SIZE} />}
        {state === 'waiting' && index}
      </span>
      <span className={styles.stepText}>
        <span className={styles.stepTitle}>{title}</span>
        <span className={styles.stepCaption}>{caption}</span>
      </span>
    </li>
  );
}

interface MinutesCheckProps {
  meeting: Meeting;
  myId?: number;
  /** 작성 완료(확정)되면 상단 바의 "회의 끝남"을 숨긴다 */
  onConfirmedChange?: (isConfirmed: boolean) => void;
  onError: (text: string) => void;
}

/**
 * REQ-175 회의가 끝난 뒤의 회의록 확인 화면 가운데 (디자인 Page 9 08 회의록 확인). 회의 대기 화면이 이 화면으로 바뀐다.
 * 작성 완료 전에는 진행 단계 카드(작성자는 [회의록 편집하기]), 완료 뒤에는 회의록을 문서로 보여 준다
 */
export default function MinutesCheck({ meeting, myId, onConfirmedChange, onError }: MinutesCheckProps) {
  const navigate = useNavigate();
  const [minutes, setMinutes] = useState<MinutesDetail | null>(null);
  const [templates, setTemplates] = useState<MinutesTemplate[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadRef = useRef<HTMLButtonElement>(null);
  const viewedRef = useRef(false);
  const editorPath = `/meetings/${meeting.meetingId}/minutes`;

  const load = useCallback(async () => {
    try {
      const { detail, templateList } = await fetchMinutes(meeting.meetingId);
      setMinutes(detail);
      setTemplates(templateList);
      if (!viewedRef.current) {
        viewedRef.current = true;
        markMinutesViewed(detail.minutesId).catch(() => undefined);
      }
    } catch (error) {
      // 회의를 막 마무리하면 회의록이 아직 없다 (만드는 중으로 보인다)
      if (!isApiError(error, MINUTES_ERROR_CODES.notReady)) {
        onError(errorMessage(error));
      }
    }
  }, [meeting.meetingId, onError]);

  const isConfirmed = minutes !== null && minutes.status !== 'WRITING';
  const isDrafting = minutes === null || minutes.draftStatus === null || DRAFTING_STATUSES.includes(minutes.draftStatus);

  useEffect(() => {
    onConfirmedChange?.(isConfirmed);
  }, [isConfirmed, onConfirmedChange]);

  useEffect(() => {
    if (isConfirmed) {
      return undefined;
    }
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), isDrafting ? DRAFT_POLL_MS : WRITING_POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load, isConfirmed, isDrafting]);

  const retryDraft = async () => {
    if (!minutes) {
      return;
    }
    setIsRetrying(true);
    try {
      setMinutes(await requestMinutesDraft(minutes.minutesId));
    } catch {
      onError(DRAFT_RETRY_FAILED_MESSAGE);
    } finally {
      setIsRetrying(false);
    }
  };

  const download = async (format: ExportFormat) => {
    if (!minutes) {
      return;
    }
    setIsDownloadOpen(false);
    setIsDownloading(true);
    try {
      await downloadMinutes(minutes.minutesId, format);
    } catch {
      onError(DOWNLOAD_FAILED_MESSAGE);
    } finally {
      setIsDownloading(false);
    }
  };

  const writer = minutes?.writer ?? meeting.writer;
  const isWriter = writer !== undefined && writer.userId === myId;
  const writerName = writer?.name ?? '작성자';
  const endTime = meeting.finishedAt?.slice(11, 16) ?? meeting.endTime;
  const isFailed = minutes?.draftStatus === 'FAILED';
  const isDraftReady = minutes?.draftStatus === 'SUCCEEDED';

  const head = (
    <div className={styles.head}>
      <div className={styles.titleBlock}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>회의록</h1>
          <span className={isConfirmed ? `${styles.badge} ${styles.badgeConfirmed}` : styles.badge}>
            {isConfirmed ? '회의록 확정' : '회의록 작성 중'}
          </span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.meta}>
            <Icon src={scheduleIcon} size={ICON_SIZE} className={styles.mutedIcon} />
            {formatMeetingSchedule(meeting.date, meeting.startTime, endTime)}
          </span>
          {meeting.location && (
            <span className={styles.meta}>
              <Icon src={locationIcon} size={ICON_SIZE} className={styles.mutedIcon} />
              {meeting.location}
            </span>
          )}
          {isConfirmed && <span className={styles.meta}>{writerName} 님이 공유</span>}
        </div>
      </div>
      {isConfirmed ? (
        <div className={styles.headButtons}>
          {/* 작성자가 아니면 [수정하기] 없이 [다운로드]만 */}
          {isWriter && (
            <button type="button" className={styles.secondary} onClick={() => navigate(editorPath)}>
              <Icon src={editIcon} size={BUTTON_ICON_SIZE} />
              수정하기
            </button>
          )}
          <span className={styles.anchor}>
            <button
              ref={downloadRef}
              type="button"
              className={styles.primary}
              aria-haspopup="menu"
              aria-expanded={isDownloadOpen}
              disabled={isDownloading}
              onClick={() => setIsDownloadOpen((open) => !open)}
            >
              {isDownloading ? <Spinner size={BUTTON_ICON_SIZE} /> : <Icon src={downloadIcon} size={BUTTON_ICON_SIZE} />}
              다운로드
            </button>
            {/* REQ-137 다운로드 형식 고르기 */}
            {isDownloadOpen && (
              <ActionMenu
                label="다운로드 형식"
                anchorRef={downloadRef}
                className={styles.downloadMenu}
                items={[
                  { label: 'PDF로 다운로드', onSelect: () => void download('PDF') },
                  { label: 'Word (.docx)로 다운로드', onSelect: () => void download('DOCX') },
                ]}
                onClose={() => setIsDownloadOpen(false)}
              />
            )}
          </span>
        </div>
      ) : null}
    </div>
  );

  if (isConfirmed) {
    const info: DocInfo[] = [
      { label: '일시', value: scheduleLabel(minutes.meetingStartAt, meeting.finishedAt) },
      ...(minutes.location ? [{ label: '장소', value: minutes.location }] : []),
      {
        label: '참석자',
        value: `${minutes.attendees.map(({ name }) => name).join(', ')} (${minutes.attendees.length}명)`,
      },
    ];
    return (
      <>
        {head}
        <div className={styles.document}>
          <MinutesDocument
            minutes={minutes}
            sections={minutes.sections}
            info={info}
            canEdit={false}
            templates={templates}
            onChangeSection={() => undefined}
          />
        </div>
      </>
    );
  }

  // 디자인 카드 제목, 설명 (MSG-071, MSG-072, MSG-055, MSG-056)
  const card = !isWriter
    ? {
        title: '작성자가 회의록을 정리하고 있어요',
        description: `${writerName} 님이 [작성 완료]를 누르면 여기에서 회의록을 문서로 볼 수 있어요. 완료되면 알림으로 알려 드릴게요.`,
      }
    : isFailed
      ? {
          title: 'AI 초안을 만들지 못했어요',
          description: '[다시 만들기]를 눌러 다시 시도하거나, 편집 화면에서 직접 작성할 수 있어요.',
        }
      : isDraftReady
        ? { title: '회의록 초안이 준비됐어요', description: '내가 다듬고 [작성 완료]를 누르면 참여자 모두에게 공개돼요.' }
        : {
            title: 'AI가 회의록 초안을 만들고 있어요',
            description: '1~2분 정도 걸려요. 기다리는 동안에도 편집 화면에 들어갈 수 있어요.',
          };
  const draftStep: { state: StepState; caption: string } = isFailed
    ? { state: 'failed', caption: '만들지 못했어요' }
    : isDraftReady
      ? { state: 'done', caption: '완료' }
      : { state: 'active', caption: '만들고 있어요' };
  const writeStep = isWriter
    ? {
        title: '내가 정리하기',
        caption: isFailed
          ? '직접 작성해도 돼요'
          : isDraftReady
            ? '편집 화면에서 고치고 [작성 완료]를 눌러요'
            : '초안이 오면 고치고 [작성 완료]를 눌러요',
      }
    : { title: '작성자 정리', caption: `${writerName} 님이 정리하고 있어요` };

  return (
    <>
      {head}
      <section className={styles.card} aria-labelledby="minutes-check-title">
        <div className={styles.cardHead}>
          <h2 id="minutes-check-title" className={styles.cardTitle}>
            {card.title}
          </h2>
          <p className={styles.cardDescription}>{card.description}</p>
        </div>
        <ol className={styles.steps}>
          <Step
            index={1}
            state="done"
            title="회의 끝남"
            caption={meeting.finishedAt ? formatShortDateTime(meeting.finishedAt) : '회의를 마쳤어요'}
          />
          <Step index={2} state={draftStep.state} title="AI 초안 만들기" caption={draftStep.caption} />
          <Step
            index={3}
            state={isDraftReady ? 'active' : 'waiting'}
            title={writeStep.title}
            caption={writeStep.caption}
          />
          <Step
            index={4}
            state="waiting"
            title="작성 완료 · 공유"
            caption={isWriter ? '참여자 모두에게 공개돼요' : '완료되면 참여자 모두에게 공개돼요'}
          />
        </ol>
        {isWriter && (
          <div className={styles.cardButtons}>
            {isFailed ? (
              <>
                <button type="button" className={styles.primary} disabled={isRetrying} onClick={() => void retryDraft()}>
                  {isRetrying ? <Spinner size={BUTTON_ICON_SIZE} /> : <Icon src={refreshIcon} size={BUTTON_ICON_SIZE} />}
                  다시 만들기
                </button>
                <button type="button" className={styles.secondary} onClick={() => navigate(editorPath)}>
                  <Icon src={editIcon} size={BUTTON_ICON_SIZE} />
                  직접 작성하기
                </button>
              </>
            ) : (
              <button type="button" className={styles.primary} onClick={() => navigate(editorPath)}>
                <Icon src={editIcon} size={BUTTON_ICON_SIZE} />
                회의록 편집하기
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
