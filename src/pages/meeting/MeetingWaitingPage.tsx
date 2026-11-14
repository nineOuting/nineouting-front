import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { errorMessage, isApiError } from '../../api/client';
import {
  cancelMeeting,
  chooseMeetingTemplate,
  getMeetingDetail,
  listPendingAgendas,
  MEETING_ERROR_CODES,
  startMeeting,
  toMeeting,
  updateMeeting,
} from '../../api/meeting';
import { listMinutesTemplates, setTemplateFavorite } from '../../api/minutes';
import { getMe } from '../../api/user';
import { getFolder, listFolderMemberDetails, listFolderMembers } from '../../api/workspace';
import checkIcon from '../../assets/icons/check-sm.svg';
import chevronLeftIcon from '../../assets/icons/chevron-left.svg';
import chevronRightIcon from '../../assets/icons/chevron-right-sm.svg';
import deleteIcon from '../../assets/icons/delete.svg';
import editIcon from '../../assets/icons/edit.svg';
import errorIcon from '../../assets/icons/error.svg';
import groupAddIcon from '../../assets/icons/group-add.svg';
import locationIcon from '../../assets/icons/location.svg';
import moreIcon from '../../assets/icons/more-vert.svg';
import playIcon from '../../assets/icons/play.svg';
import scheduleIcon from '../../assets/icons/schedule.svg';
import AppLayout from '../../components/AppLayout';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import Icon from '../../components/Icon';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { Meeting, MeetingStatus, Member, MinutesTemplate, PendingAgenda } from '../../types/meeting';
import { formatMeetingSchedule } from '../../utils/meetingFormat';
import { pendingAgendasFor, withCarriedOverDates } from '../../utils/pendingAgenda';
import ActionMenu from '../workspace/ActionMenu';
import AgendaBoard from './AgendaBoard';
import ConsentModal from './ConsentModal';
import MeetingMaterials from './MeetingMaterials';
import MemberPickerMenu from './MemberPickerMenu';
import MicPermissionDialog from './MicPermissionDialog';
import StartingModal from './StartingModal';
import TemplateDetailModal from './TemplateDetailModal';
import TemplateGalleryModal from './TemplateGalleryModal';
import styles from './MeetingWaitingPage.module.css';

const ICON_SIZE = 20;
const BACK_ICON_SIZE = 24;
const HEADER_AVATAR_COUNT = 4;
const SMALL_ICON_SIZE = 16;
const START_FAILED_MESSAGE = '회의를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.';

type TemplateModalState = { view: 'gallery' } | { view: 'detail'; index: number };
type OpenMenu = 'attendee' | 'writer' | 'more';

const STATUS_LABELS: Record<MeetingStatus, string> = {
  SCHEDULED: '회의 예정',
  IN_PROGRESS: '회의 중',
  FINISHED: '회의 종료',
  CANCELLED: '취소된 회의',
};

function readinessMessage(hasAgenda: boolean, hasWriter: boolean) {
  if (hasAgenda && hasWriter) {
    return '필수 정보를 모두 입력했어요';
  }
  if (!hasAgenda && !hasWriter) {
    return '안건과 회의록 작성자를 정해 주세요';
  }
  return hasAgenda ? '회의록 작성자를 선택해 주세요' : '안건을 추가해 주세요';
}

function minutesBetween(startTime: string, endTime: string) {
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  return startTime && endTime ? toMinutes(endTime) - toMinutes(startTime) : undefined;
}

function Avatar({ member }: { member: Member }) {
  if (member.profileImageUrl) {
    return <img src={member.profileImageUrl} alt={member.name} className={styles.avatar} />;
  }
  return (
    <span className={styles.avatar} role="img" aria-label={member.name}>
      {member.name.slice(0, 1)}
    </span>
  );
}

/** REQ-064, 073~077, 122~123 회의 대기 화면 */
export default function MeetingWaitingPage() {
  const navigate = useNavigate();
  const { meetingId } = useParams();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [myId, setMyId] = useState<number>();
  const [folderMembers, setFolderMembers] = useState<Member[]>([]);
  const [emails, setEmails] = useState<Record<number, string>>({});
  const [pendingAgendas, setPendingAgendas] = useState<PendingAgenda[]>([]);
  // REQ-123 내가 쓸 수 있는 회의록 양식 (기본 양식 + 내 양식)과 즐겨찾기 표시
  const [templates, setTemplates] = useState<MinutesTemplate[]>([]);
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [templateModal, setTemplateModal] = useState<TemplateModalState | null>(null);
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  // REQ-002 회의명 위 경로 (폴더 > 회의 상세)
  const [folderName, setFolderName] = useState('');
  // REQ-078 마이크 권한 안내 창 (MSG-065, MSG-066)
  const [micDialog, setMicDialog] = useState<'request' | 'denied' | null>(null);
  const [isCheckingMic, setIsCheckingMic] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [materialCount, setMaterialCount] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeMenu = useCallback(() => setOpenMenu(null), []);
  const attendeeAnchorRef = useRef<HTMLButtonElement>(null);
  const writerAnchorRef = useRef<HTMLButtonElement>(null);
  const moreAnchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      const loaded = toMeeting(await getMeetingDetail(meetingId ?? ''));
      const [members, pending, folder, me, templateList] = await Promise.all([
        listFolderMembers(loaded.folderId),
        listPendingAgendas(loaded.folderId),
        getFolder(loaded.folderId).catch(() => null),
        getMe().catch(() => null),
        listMinutesTemplates().catch(() => []),
      ]);
      if (!isCurrent) {
        return;
      }
      setFolderName(folder?.name ?? '');
      // 작성자·참여자 고르기 목록에 이메일을 함께 보여 준다 (없어도 이름으로 고를 수 있다)
      listFolderMemberDetails(loaded.folderId)
        .then((details) => isCurrent && setEmails(Object.fromEntries(details.map(({ userId, email }) => [userId, email]))))
        .catch(() => undefined);
      setMyId(me?.userId);
      const usable = pendingAgendasFor(pending, loaded.meetingId);
      setFolderMembers(members);
      setPendingAgendas(usable);
      setTemplates(templateList.map(({ templateId, name, favorite }) => ({ templateId, name, isFavorite: favorite })));
      setMeeting({ ...loaded, agendas: withCarriedOverDates(loaded.agendas, usable) });
    };
    load().catch((error: unknown) => {
      if (isCurrent) {
        setToast({ text: errorMessage(error), variant: 'error' });
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [meetingId]);

  if (!meeting) {
    // 불러오는 동안에도 접힌 메뉴로 그린다 (같은 AppLayout이 이어서 쓰여 메뉴 열림 상태가 남는다)
    return (
      <AppLayout className={styles.page} variant="compact">
        {toast && <Toast message={toast} onClose={closeToast} />}
      </AppLayout>
    );
  }
  if (meeting.status === 'IN_PROGRESS') {
    return <Navigate to={`/meetings/${meeting.meetingId}/room`} replace />;
  }

  const isScheduled = meeting.status === 'SCHEDULED';
  const isAttendee = meeting.attendees.some(({ userId }) => userId === myId);
  // REQ-130 회의 시작 전에는 참석자만 안건, 참여자, 작성자를 고친다. 참석자가 아닌 폴더 멤버는 보기만 한다
  const canEdit = isScheduled && isAttendee;
  const isReady = isScheduled && meeting.agendas.length > 0 && Boolean(meeting.writer);
  const selectedTemplate = templates.find(({ templateId }) => templateId === meeting.templateId);

  /** REQ-064, 122 안건·참석자·회의록 작성자는 바꾸는 즉시 저장한다. 실패하면 되돌린다 */
  const saveMeeting = async (patch: Partial<Meeting>): Promise<boolean> => {
    const before = meeting;
    const next = { ...meeting, ...patch };
    setMeeting(next);
    try {
      const saved = await updateMeeting(next);
      setMeeting(
        (prev) =>
          prev && {
            ...saved,
            agendas: withCarriedOverDates(saved.agendas, pendingAgendas),
            materials: prev.materials,
          },
      );
      return true;
    } catch (error) {
      setMeeting(before);
      setToast({ text: errorMessage(error), variant: 'error' });
      return false;
    }
  };

  const toggleMenu = (menu: OpenMenu) => setOpenMenu((current) => (current === menu ? null : menu));

  const addAttendee = (member: Member) => {
    if (!meeting.attendees.some(({ userId }) => userId === member.userId)) {
      void saveMeeting({ attendees: [...meeting.attendees, member] });
    }
  };

  /** REQ-123 고른 양식은 바로 저장한다. 회의를 마무리하면 이 양식으로 회의록을 만든다. 실패하면 되돌린다 */
  const chooseTemplate = async (templateId: number) => {
    const before = meeting.templateId;
    setMeeting((prev) => prev && { ...prev, templateId });
    try {
      await chooseMeetingTemplate(meeting.meetingId, templateId);
    } catch (error) {
      setMeeting((prev) => prev && { ...prev, templateId: before });
      setToast({ text: errorMessage(error), variant: 'error' });
    }
  };

  /** REQ-123 즐겨찾기는 나만 보는 표시라 참석자가 아니어도 된다. 실패하면 되돌린다 */
  const toggleFavorite = async (templateId: number) => {
    const target = templates.find((template) => template.templateId === templateId);
    if (!target) {
      return;
    }
    const flip = (isFavorite: boolean) =>
      setTemplates((prev) =>
        prev.map((template) => (template.templateId === templateId ? { ...template, isFavorite } : template)),
      );
    flip(!target.isFavorite);
    try {
      await setTemplateFavorite(templateId, !target.isFavorite);
    } catch (error) {
      flip(target.isFavorite);
      setToast({ text: errorMessage(error), variant: 'error' });
    }
  };

  /** REQ-077 동의하면 마이크 권한을 확인한다. 처음이면 먼저 안내하고(MSG-065), 꺼져 있으면 켜는 방법을 알려 준다(MSG-066) */
  const start = async () => {
    setIsConsentOpen(false);
    const state = await navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((status) => status.state)
      .catch(() => 'prompt' as const);
    if (state === 'granted') {
      await requestMicAndStart();
    } else {
      setMicDialog(state === 'denied' ? 'denied' : 'request');
    }
  };

  /** 브라우저에 마이크 권한을 요청한다. 녹음은 회의 진행 화면에서 시작한다 */
  const requestMicAndStart = async () => {
    setIsCheckingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setIsCheckingMic(false);
      setMicDialog('denied');
      return;
    }
    setIsCheckingMic(false);
    setMicDialog(null);
    setIsStarting(true);
    try {
      await startMeeting(meeting.meetingId);
    } catch (error) {
      // 다른 탭에서 이미 시작했으면 그대로 회의방으로 들어간다
      if (!isApiError(error, MEETING_ERROR_CODES.alreadyStarted)) {
        setIsStarting(false);
        // 디자인 MeetingWaiting_StartFailed: 위쪽 알림 + 다시 시도
        setToast({
          text: isApiError(error) ? errorMessage(error) : START_FAILED_MESSAGE,
          variant: 'error',
          action: { label: '다시 시도', onClick: () => setIsConsentOpen(true) },
        });
        return;
      }
    }
    navigate(`/meetings/${meeting.meetingId}/room`);
  };

  const cancel = async () => {
    setIsCancelDialogOpen(false);
    try {
      await cancelMeeting(meeting.meetingId);
      navigate('/home', { replace: true });
    } catch (error) {
      setToast({ text: errorMessage(error), variant: 'error' });
    }
  };

  const duration = minutesBetween(meeting.startTime, meeting.endTime);
  const headerAvatars = meeting.attendees.slice(0, HEADER_AVATAR_COUNT);
  const moreItems = canEdit
    ? [
        {
          label: '회의 정보 수정',
          icon: editIcon,
          onSelect: () => navigate(`/meetings/${meeting.meetingId}/edit`, { state: { meeting } }),
        },
        { label: '회의 삭제', icon: deleteIcon, isDanger: true, onSelect: () => setIsCancelDialogOpen(true) },
      ]
    : [];

  // 디자인 Version02 MeetingWaiting 상단 바: 뒤로 가기, 회의명, 참여자 얼굴 / 준비 상태, 회의 시작하기
  const header = (
    <div className={styles.topBar}>
      <div className={styles.topLeft}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="프로젝트 폴더로 돌아가기"
          title={folderName || undefined}
          onClick={() => navigate(`/folders/${meeting.folderId}`)}
        >
          <Icon src={chevronLeftIcon} size={BACK_ICON_SIZE} />
        </button>
        <span className={styles.topTitle}>{meeting.title}</span>
        <span className={styles.topAvatars} aria-label={`참여자 ${meeting.attendees.length}명`}>
          {headerAvatars.map((member) => (
            <Avatar key={member.userId} member={member} />
          ))}
        </span>
      </div>
      {isScheduled && (
        <div className={styles.topRight}>
          <p className={[styles.readiness, isReady ? styles.ready : styles.notReady].join(' ')}>
            <Icon src={isReady ? checkIcon : errorIcon} size={SMALL_ICON_SIZE} />
            {readinessMessage(meeting.agendas.length > 0, Boolean(meeting.writer))}
          </p>
          <Button size="md" disabled={!isReady || isStarting} onClick={() => setIsConsentOpen(true)}>
            <Icon src={playIcon} size={ICON_SIZE} />
            {isStarting ? '회의 준비 중' : '회의 시작하기'}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout className={styles.page} variant="compact" header={header}>
      {toast && <Toast message={toast} onClose={closeToast} />}

      <div className={styles.columns}>
        <div className={styles.main}>
          <div className={styles.head}>
            <div className={styles.titleBlock}>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>오늘 논의할 안건</h1>
                <span className={styles.badge}>{STATUS_LABELS[meeting.status]}</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.meta}>
                  <Icon src={scheduleIcon} size={SMALL_ICON_SIZE} className={styles.mutedIcon} />
                  {formatMeetingSchedule(meeting.date, meeting.startTime, meeting.endTime)}
                </span>
                {meeting.location && (
                  <span className={styles.meta}>
                    <Icon src={locationIcon} size={SMALL_ICON_SIZE} className={styles.mutedIcon} />
                    {meeting.location}
                  </span>
                )}
              </div>
            </div>
            {moreItems.length > 0 && (
              <div className={styles.menuAnchor}>
                <button
                  ref={moreAnchorRef}
                  type="button"
                  className={[styles.iconButton, openMenu === 'more' ? styles.iconButtonActive : ''].filter(Boolean).join(' ')}
                  aria-label="회의 더보기"
                  aria-haspopup="menu"
                  aria-expanded={openMenu === 'more'}
                  onClick={() => toggleMenu('more')}
                >
                  <Icon src={moreIcon} size={ICON_SIZE} />
                </button>
                {openMenu === 'more' && (
                  <ActionMenu
                    label="회의 더보기"
                    anchorRef={moreAnchorRef}
                    className={styles.moreMenu}
                    items={moreItems.map((item) => ({
                      ...item,
                      onSelect: () => {
                        closeMenu();
                        item.onSelect();
                      },
                    }))}
                    onClose={closeMenu}
                  />
                )}
              </div>
            )}
          </div>

          {meeting.status === 'CANCELLED' && <p className={styles.cancelled}>취소된 회의예요</p>}

          <AgendaBoard
            agendas={meeting.agendas}
            pendingAgendas={pendingAgendas}
            canEdit={canEdit}
            durationMinutes={duration}
            onSave={(agendas) => saveMeeting({ agendas })}
            onCarryOver={(_, undo) =>
              setToast({ text: '이번 회의 안건에 추가했어요', variant: 'success', action: { label: '되돌리기', onClick: undo } })
            }
          />
        </div>

        <aside className={styles.side}>
          <section className={styles.sideSection}>
            <div className={`${styles.sideHead} ${styles.menuAnchor}`}>
              <h2 className={styles.sideTitle}>참여자 {meeting.attendees.length}명</h2>
              {canEdit && (
                <button
                  ref={attendeeAnchorRef}
                  type="button"
                  className={styles.iconButton}
                  aria-label="참여자 추가"
                  aria-haspopup="listbox"
                  aria-expanded={openMenu === 'attendee'}
                  onClick={() => toggleMenu('attendee')}
                >
                  <Icon src={groupAddIcon} size={ICON_SIZE} />
                </button>
              )}
              {openMenu === 'attendee' && (
                <MemberPickerMenu
                  title="참여자 추가"
                  emptyText="추가할 폴더 멤버가 없어요"
                  anchorRef={attendeeAnchorRef}
                  className={styles.sideMenu}
                  members={folderMembers.filter(({ userId }) => !meeting.attendees.some((member) => member.userId === userId))}
                  selectedIds={[]}
                  emails={emails}
                  footnote="같은 폴더 멤버만 추가할 수 있어요"
                  onSelect={addAttendee}
                  onClose={closeMenu}
                />
              )}
            </div>
            <ul className={styles.attendeeList}>
              {meeting.attendees.map((member) => (
                <li key={member.userId} className={styles.attendeeRow}>
                  <Avatar member={member} />
                  <span className={styles.attendeeName}>{member.name}</span>
                  <span className={styles.attendeeRole}>
                    {member.userId === meeting.writer?.userId ? '회의록 작성자' : '참여자'}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.sideSection}>
            <h2 className={styles.sideTitle}>회의록 설정</h2>
            <div className={styles.settingsCard}>
              <button
                type="button"
                className={styles.settingRow}
                onClick={() => setTemplateModal({ view: 'gallery' })}
              >
                <span className={styles.templateName}>{selectedTemplate?.name ?? '회의록 양식 고르기'}</span>
                <Icon src={chevronRightIcon} size={SMALL_ICON_SIZE} className={styles.mutedIcon} />
              </button>
              <div className={styles.menuAnchor}>
                <button
                  ref={writerAnchorRef}
                  type="button"
                  className={styles.settingRow}
                  aria-haspopup="listbox"
                  aria-expanded={openMenu === 'writer'}
                  disabled={!canEdit}
                  onClick={() => toggleMenu('writer')}
                >
                  <span className={styles.settingLabel}>회의록 작성자</span>
                  <span className={meeting.writer ? styles.settingValue : styles.settingPlaceholder}>
                    {meeting.writer?.name ?? '선택해 주세요'}
                  </span>
                  <Icon src={chevronRightIcon} size={SMALL_ICON_SIZE} className={styles.mutedIcon} />
                </button>
                {openMenu === 'writer' && (
                  <MemberPickerMenu
                    title="회의 참석자"
                    emptyText="회의 참여자를 먼저 추가해 주세요"
                    anchorRef={writerAnchorRef}
                    className={styles.writerMenu}
                    members={meeting.attendees}
                    selectedIds={meeting.writer ? [meeting.writer.userId] : []}
                    emails={emails}
                    footnote="회의록 작성자는 참석자 중 한 명이에요"
                    onSelect={(member) => {
                      void saveMeeting({ writer: member });
                      closeMenu();
                    }}
                    onClose={closeMenu}
                  />
                )}
              </div>
            </div>
          </section>

          <section className={styles.sideSection}>
            <div className={styles.sideHead}>
              <h2 className={styles.sideTitle}>사전 자료{materialCount > 0 ? ` ${materialCount}` : ''}</h2>
              {isAttendee && meeting.status !== 'CANCELLED' && (
                <button type="button" className={styles.linkButton} onClick={() => setIsUploadOpen(true)}>
                  올리기
                </button>
              )}
            </div>
            <MeetingMaterials
              meetingId={meeting.meetingId}
              canUpload={isAttendee && meeting.status !== 'CANCELLED'}
              isUploadOpen={isUploadOpen}
              onUploadClose={() => setIsUploadOpen(false)}
              onCountChange={setMaterialCount}
              onUploaded={(count, undo) =>
                setToast({ text: `자료 ${count}개를 올렸어요`, variant: 'success', action: { label: '되돌리기', onClick: undo } })
              }
            />
          </section>
        </aside>
      </div>

      {templateModal?.view === 'gallery' && (
        <TemplateGalleryModal
          templates={templates}
          selectedId={meeting.templateId}
          onOpenDetail={(index) => setTemplateModal({ view: 'detail', index })}
          onToggleFavorite={(templateId) => void toggleFavorite(templateId)}
          onCreateTemplate={() => navigate('/templates/new')}
          onClose={() => setTemplateModal(null)}
        />
      )}
      {templateModal?.view === 'detail' && (
        <TemplateDetailModal
          templates={templates}
          index={templateModal.index}
          onChangeIndex={(index) => setTemplateModal({ view: 'detail', index })}
          onUse={
            canEdit
              ? (templateId) => {
                  void chooseTemplate(templateId);
                  setTemplateModal(null);
                }
              : undefined
          }
          onClose={() => setTemplateModal({ view: 'gallery' })}
        />
      )}
      {isConsentOpen && <ConsentModal onCancel={() => setIsConsentOpen(false)} onAgree={start} />}
      {isStarting && <StartingModal />}
      {micDialog && (
        <MicPermissionDialog
          state={micDialog}
          isChecking={isCheckingMic}
          onAllow={() => void requestMicAndStart()}
          onClose={() => setMicDialog(null)}
        />
      )}
      {isCancelDialogOpen && (
        <ConfirmDialog
          title="회의를 삭제할까요?"
          message={'삭제하면 참석자에게 알림이 가고\n되돌릴 수 없어요.'}
          cancelLabel="돌아가기"
          confirmLabel="회의 삭제"
          isDanger
          onCancel={() => setIsCancelDialogOpen(false)}
          onConfirm={cancel}
        />
      )}
    </AppLayout>
  );
}
