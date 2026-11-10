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
import { getFolder, listFolderMembers } from '../../api/workspace';
import checkCircleIcon from '../../assets/icons/check-circle.svg';
import chevronDownIcon from '../../assets/icons/chevron-down.svg';
import createIcon from '../../assets/icons/create.svg';
import groupAddIcon from '../../assets/icons/group-add-sm.svg';
import infoIcon from '../../assets/icons/info.svg';
import locationIcon from '../../assets/icons/location.svg';
import playIcon from '../../assets/icons/play.svg';
import scheduleIcon from '../../assets/icons/schedule.svg';
import separatorIcon from '../../assets/icons/breadcrumb-sep.svg';
import AppLayout from '../../components/AppLayout';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DropdownMenu from '../../components/DropdownMenu';
import Icon from '../../components/Icon';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { Meeting, MeetingStatus, Member, MinutesTemplate, PendingAgenda } from '../../types/meeting';
import { formatMeetingSchedule } from '../../utils/meetingFormat';
import { pendingAgendasFor, withCarriedOverDates } from '../../utils/pendingAgenda';
import AgendaEditor from './AgendaEditor';
import ConsentModal from './ConsentModal';
import MeetingMaterials from './MeetingMaterials';
import MicPermissionDialog from './MicPermissionDialog';
import StartingModal from './StartingModal';
import TemplateDetailModal from './TemplateDetailModal';
import TemplateGalleryModal from './TemplateGalleryModal';
import styles from './MeetingWaitingPage.module.css';

const SEPARATOR_ICON_SIZE = 16;
const ICON_SIZE = 20;
const SMALL_ICON_SIZE = 16;
const START_FAILED_MESSAGE = '회의를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.';

type TemplateModalState = { view: 'gallery' } | { view: 'detail'; index: number };
type OpenMenu = 'attendee' | 'template' | 'writer';

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
  return hasAgenda ? '회의록 작성자를 선택해 주세요' : '안건을 1개 이상 등록해 주세요';
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
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeMenu = useCallback(() => setOpenMenu(null), []);
  const attendeeAnchorRef = useRef<HTMLButtonElement>(null);
  const templateAnchorRef = useRef<HTMLButtonElement>(null);
  const writerAnchorRef = useRef<HTMLButtonElement>(null);

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
    return <AppLayout className={styles.page}>{toast && <Toast message={toast} onClose={closeToast} />}</AppLayout>;
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
  const saveMeeting = async (patch: Partial<Meeting>) => {
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
    } catch (error) {
      setMeeting(before);
      setToast({ text: errorMessage(error), variant: 'error' });
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
        setToast({ text: isApiError(error) ? errorMessage(error) : START_FAILED_MESSAGE, variant: 'error' });
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

  return (
    <AppLayout className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}

      <div className={styles.head}>
        <div className={styles.titleBlock}>
          {/* REQ-002 회의 대기 화면은 회의명 위에 경로를 보여 준다. 누르면 그 위치로 간다 */}
          <nav className={styles.breadcrumb} aria-label="현재 위치">
            <button type="button" className={styles.crumb} onClick={() => navigate(`/folders/${meeting.folderId}`)}>
              {folderName || '프로젝트 폴더'}
            </button>
            <Icon src={separatorIcon} size={SEPARATOR_ICON_SIZE} className={styles.separator} />
            <span aria-current="page" className={styles.crumbCurrent}>
              회의 상세
            </span>
          </nav>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{meeting.title}</h1>
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
        {canEdit && (
          <button
            type="button"
            className={styles.editInfo}
            onClick={() => navigate(`/meetings/${meeting.meetingId}/edit`, { state: { meeting } })}
          >
            <Icon src={createIcon} size={ICON_SIZE} />
            정보 수정
          </button>
        )}
      </div>

      <div className={styles.columns}>
        <div className={styles.main}>
          <section className={`${styles.card} ${styles.agendaSection}`}>
            <div className={styles.titleGroup}>
              <h2 className={styles.sectionTitle}>회의 안건</h2>
              <p className={styles.sectionCaption}>회의에서 논의할 안건 {meeting.agendas.length}개</p>
            </div>
            <AgendaEditor
              agendas={meeting.agendas}
              pendingAgendas={pendingAgendas}
              onChange={(agendas) => void saveMeeting({ agendas })}
              readOnly={!canEdit}
            />
          </section>

          <div className={styles.startBlock}>
            <p className={[styles.readiness, isReady ? styles.ready : ''].filter(Boolean).join(' ')}>
              <Icon src={isReady ? checkCircleIcon : infoIcon} size={SMALL_ICON_SIZE} />
              {/* 취소된 회의는 준비 상태 대신 취소됐다고만 알린다 */}
              {meeting.status === 'CANCELLED'
                ? '취소된 회의예요'
                : readinessMessage(meeting.agendas.length > 0, Boolean(meeting.writer))}
            </p>
            <Button disabled={!isReady || isStarting} onClick={() => setIsConsentOpen(true)}>
              <Icon src={playIcon} size={ICON_SIZE} />
              {isStarting ? '회의 준비 중' : '회의 시작하기'}
            </Button>
            <p className={styles.startNote}>회의를 시작하면 참여자에게 녹음, 전사 동의를 받아요</p>
          </div>
        </div>

        <aside className={styles.side}>
          <div className={`${styles.card} ${styles.settingsPanel}`}>
          <section className={styles.attendees}>
            <div className={`${styles.attendeeHead} ${styles.menuAnchor}`}>
              <h2 className={styles.sideTitle}>회의 참여자</h2>
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
                <DropdownMenu
                  label="참여자 추가"
                  emptyText="추가할 폴더 멤버가 없어요"
                  anchorRef={attendeeAnchorRef}
                  items={folderMembers
                    .filter(({ userId }) => !meeting.attendees.some((member) => member.userId === userId))
                    .map((member) => ({ id: String(member.userId), label: member.name }))}
                  onSelect={(id) => {
                    const member = folderMembers.find(({ userId }) => String(userId) === id);
                    if (member) {
                      addAttendee(member);
                    }
                  }}
                  onClose={closeMenu}
                />
              )}
            </div>
            <p className={styles.attendeeCount}>참여자 {meeting.attendees.length}명</p>
            <div className={styles.avatars}>
              {meeting.attendees.map((member) => (
                <Avatar key={member.userId} member={member} />
              ))}
            </div>
          </section>

          <div className={styles.sideDivider} />

          <section className={styles.minutesSettings}>
            <div className={styles.sideHead}>
              <h2 className={styles.sideTitle}>회의록 설정</h2>
              <button type="button" className={styles.textButton} onClick={() => setTemplateModal({ view: 'gallery' })}>
                양식 전체보기
              </button>
            </div>
            <div className={styles.settingGroup}>
              <div className={styles.settingField}>
                <span className={styles.settingLabelRow}>회의록 양식</span>
                <div className={styles.menuAnchor}>
                  <button
                    ref={templateAnchorRef}
                    type="button"
                    className={styles.selectBox}
                    aria-haspopup="listbox"
                    aria-expanded={openMenu === 'template'}
                    disabled={!canEdit}
                    onClick={() => toggleMenu('template')}
                  >
                    <span className={selectedTemplate ? styles.selectValue : styles.selectPlaceholder}>
                      {selectedTemplate?.name ?? '양식을 선택해 주세요'}
                    </span>
                    <Icon src={chevronDownIcon} size={ICON_SIZE} className={styles.mutedIcon} />
                  </button>
                  {openMenu === 'template' && (
                    <DropdownMenu
                      label="즐겨찾기한 회의록 양식"
                      emptyText="즐겨찾기한 양식이 없어요. 전체보기에서 즐겨찾기해 주세요"
                      anchorRef={templateAnchorRef}
                      items={templates
                        .filter(({ isFavorite }) => isFavorite)
                        .map((template) => ({
                          id: String(template.templateId),
                          label: template.name,
                          isSelected: template.templateId === meeting.templateId,
                        }))}
                      onSelect={(id) => {
                        void chooseTemplate(Number(id));
                        closeMenu();
                      }}
                      onClose={closeMenu}
                    />
                  )}
                </div>
                <p className={styles.settingCaption}>즐겨찾기한 양식 중에서 고를 수 있어요</p>
              </div>
              <div className={styles.settingField}>
                <span className={styles.settingLabelRow}>회의록 작성자</span>
                <div className={styles.menuAnchor}>
                  <button
                    ref={writerAnchorRef}
                    type="button"
                    className={styles.selectBox}
                    aria-haspopup="listbox"
                    aria-expanded={openMenu === 'writer'}
                    disabled={!canEdit}
                    onClick={() => toggleMenu('writer')}
                  >
                    <span className={meeting.writer ? styles.selectValue : styles.selectPlaceholder}>
                      {meeting.writer?.name ?? '작성자를 선택해 주세요'}
                    </span>
                    <Icon src={chevronDownIcon} size={ICON_SIZE} className={styles.mutedIcon} />
                  </button>
                  {openMenu === 'writer' && (
                    <DropdownMenu
                      label="회의록 작성자"
                      emptyText="회의 참여자를 먼저 추가해 주세요"
                      anchorRef={writerAnchorRef}
                      items={meeting.attendees.map((member) => ({
                        id: String(member.userId),
                        label: member.name,
                        isSelected: member.userId === meeting.writer?.userId,
                      }))}
                      onSelect={(id) => {
                        void saveMeeting({ writer: meeting.attendees.find(({ userId }) => String(userId) === id) });
                        closeMenu();
                      }}
                      onClose={closeMenu}
                    />
                  )}
                </div>
                <p className={styles.settingCaption}>회의 참여자 중 한 명을 골라요</p>
              </div>
            </div>
          </section>

          <div className={styles.sideDivider} />

          <section className={styles.materials}>
            <div className={styles.titleGroup}>
              <h2 className={styles.sideTitle}>사전 자료</h2>
              <p className={styles.sectionCaption}>회의 전에 필요한 자료를 공유해요</p>
            </div>
            <MeetingMaterials meetingId={meeting.meetingId} canUpload={isAttendee && meeting.status !== 'CANCELLED'} />
          </section>
          </div>

          {canEdit && (
            <Button variant="danger" size="md" block onClick={() => setIsCancelDialogOpen(true)}>
              회의 취소하기
            </Button>
          )}
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
          title="회의를 취소할까요?"
          message={'취소하면 참석자에게 알림이 가고\n되돌릴 수 없어요.'}
          cancelLabel="돌아가기"
          confirmLabel="회의 취소"
          onCancel={() => setIsCancelDialogOpen(false)}
          onConfirm={cancel}
        />
      )}
    </AppLayout>
  );
}
