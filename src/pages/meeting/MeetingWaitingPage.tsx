import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import dividerLine from '../../assets/divider-line.svg';
import dividerSide from '../../assets/divider-side.svg';
import AppLayout from '../../components/AppLayout';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DropdownMenu from '../../components/DropdownMenu';
import Placeholder from '../../components/Placeholder';
import Toast, { type ToastMessage } from '../../components/Toast';
import { FOLDER_MEMBERS, MINUTES_TEMPLATES, SAMPLE_MEETING } from '../../mocks/meeting';
import type { Agenda, Meeting, Member } from '../../types/meeting';
import { formatMeetingSchedule } from '../../utils/meetingFormat';
import AgendaCard from './AgendaCard';
import AgendaForm from './AgendaForm';
import ConsentModal from './ConsentModal';
import StartingModal from './StartingModal';
import TemplateDetailModal from './TemplateDetailModal';
import TemplateGalleryModal from './TemplateGalleryModal';
import styles from './MeetingWaitingPage.module.css';

const ICON_SIZE = 20;
const SMALL_ICON_SIZE = 16;
const MATERIAL_ICON_SIZE = 24;
const START_FAILED_MESSAGE = '회의를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.';
const NEW_TEMPLATE_PENDING_MESSAGE = '새 양식 만들기는 설정의 회의록 양식 관리 화면이 나오면 연결돼요.';

type AgendaFormState = { mode: 'new' } | { mode: 'edit'; agendaId: string };
type TemplateModalState = { view: 'gallery' } | { view: 'detail'; index: number };
type OpenMenu = 'attendee' | 'template' | 'writer';

function readinessMessage(hasAgenda: boolean, hasWriter: boolean) {
  if (hasAgenda && hasWriter) {
    return '필수 정보 입력 완료';
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

/** REQ-074~077, 100, 122 회의 대기 화면 */
export default function MeetingWaitingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // TODO(API 연동): GET /api/meetings/{meetingId}. 지금은 생성·수정 화면에서 넘겨준 값이나 예시 데이터를 쓴다
  const [meeting, setMeeting] = useState<Meeting>(
    () => (location.state as { meeting?: Meeting } | null)?.meeting ?? SAMPLE_MEETING,
  );
  const [templates, setTemplates] = useState(MINUTES_TEMPLATES);
  const [expandedAgendaId, setExpandedAgendaId] = useState<string | undefined>(meeting.agendas[0]?.id);
  const [agendaForm, setAgendaForm] = useState<AgendaFormState | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [templateModal, setTemplateModal] = useState<TemplateModalState | null>(null);
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeMenu = useCallback(() => setOpenMenu(null), []);
  const dragIndexRef = useRef<number | null>(null);
  const attendeeAnchorRef = useRef<HTMLButtonElement>(null);
  const templateAnchorRef = useRef<HTMLButtonElement>(null);
  const writerAnchorRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isReady = meeting.agendas.length > 0 && Boolean(meeting.writer);
  const selectedTemplate = templates.find(({ templateId }) => templateId === meeting.templateId);

  const updateMeeting = (patch: Partial<Meeting>) => setMeeting((prev) => ({ ...prev, ...patch }));

  const toggleMenu = (menu: OpenMenu) => setOpenMenu((current) => (current === menu ? null : menu));

  const saveAgenda = (input: Omit<Agenda, 'id'>, { continueWriting }: { continueWriting: boolean }) => {
    // TODO(API 연동): 대기 화면 안건 저장 API (docs/backlog.md)
    if (agendaForm?.mode === 'edit') {
      updateMeeting({
        agendas: meeting.agendas.map((agenda) => (agenda.id === agendaForm.agendaId ? { ...agenda, ...input } : agenda)),
      });
    } else {
      updateMeeting({ agendas: [...meeting.agendas, { ...input, id: crypto.randomUUID() }] });
    }
    if (!continueWriting) {
      setAgendaForm(null);
    }
  };

  const moveAgenda = (toIndex: number) => {
    const fromIndex = dragIndexRef.current;
    dragIndexRef.current = null;
    if (fromIndex === null || fromIndex === toIndex) {
      return;
    }
    const agendas = [...meeting.agendas];
    const [moved] = agendas.splice(fromIndex, 1);
    agendas.splice(toIndex, 0, moved);
    updateMeeting({ agendas });
  };

  const addAttendee = (member: Member) => {
    if (!meeting.attendees.some(({ userId }) => userId === member.userId)) {
      updateMeeting({ attendees: [...meeting.attendees, member] });
    }
  };

  const toggleFavorite = (templateId: string) => {
    // TODO(API 연동): 양식 즐겨찾기 API (REQ-123)
    setTemplates((prev) =>
      prev.map((template) =>
        template.templateId === templateId ? { ...template, isFavorite: !template.isFavorite } : template,
      ),
    );
  };

  const addMaterials = (event: ChangeEvent<HTMLInputElement>) => {
    // TODO(API 연동): 사전 자료 업로드 (REQ-067, S3)
    const names = Array.from(event.target.files ?? [], (file) => file.name);
    updateMeeting({ materials: [...meeting.materials, ...names] });
    event.target.value = '';
  };

  const startMeeting = async () => {
    setIsConsentOpen(false);
    setIsStarting(true);
    try {
      // REQ-077 동의하면 브라우저 마이크 권한을 요청한다. 녹음은 회의 진행 화면에서 시작한다
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      // TODO(API 연동): POST /api/meetings/{meetingId}/start
      navigate(`/meetings/${meeting.meetingId}/room`, { state: { meeting } });
    } catch {
      setIsStarting(false);
      setToast({ text: START_FAILED_MESSAGE, variant: 'error' });
    }
  };

  const cancelMeeting = () => {
    // TODO(API 연동): POST /api/meetings/{meetingId}/cancel (REQ-073)
    navigate('/home', { replace: true });
  };

  return (
    <AppLayout className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}

      <div className={styles.head}>
        <div className={styles.titleBlock}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{meeting.title}</h1>
            <span className={styles.badge}>회의 예정</span>
          </div>
          <div className={styles.metaRow}>
            <span>{formatMeetingSchedule(meeting.date, meeting.startTime, meeting.endTime)}</span>
            {meeting.location && (
              <span className={styles.location}>
                <Placeholder size={SMALL_ICON_SIZE} className={styles.mutedIcon} />
                {meeting.location}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className={styles.editInfo}
          onClick={() => navigate(`/meetings/${meeting.meetingId}/edit`, { state: { meeting } })}
        >
          <Placeholder size={SMALL_ICON_SIZE} className={styles.mutedIcon} />
          정보 수정
        </button>
      </div>

      <div className={styles.columns}>
        <div className={styles.main}>
          <section className={styles.agendaSection}>
            <div className={styles.agendaHead}>
              <h2 className={styles.agendaTitle}>회의 안건</h2>
              <span className={styles.agendaCount}>{meeting.agendas.length}개</span>
            </div>
            <ul className={styles.agendaList}>
              {meeting.agendas.map((agenda, index) =>
                agendaForm?.mode === 'edit' && agendaForm.agendaId === agenda.id ? (
                  <li key={agenda.id}>
                    <AgendaForm initialAgenda={agenda} onCancel={() => setAgendaForm(null)} onSave={saveAgenda} />
                  </li>
                ) : (
                  <AgendaCard
                    key={agenda.id}
                    agenda={agenda}
                    isExpanded={expandedAgendaId === agenda.id}
                    onToggle={() => setExpandedAgendaId((current) => (current === agenda.id ? undefined : agenda.id))}
                    onEdit={() => setAgendaForm({ mode: 'edit', agendaId: agenda.id })}
                    onDragStart={() => {
                      dragIndexRef.current = index;
                    }}
                    onDrop={() => moveAgenda(index)}
                  />
                ),
              )}
              {agendaForm?.mode === 'new' && (
                <li>
                  <AgendaForm onCancel={() => setAgendaForm(null)} onSave={saveAgenda} />
                </li>
              )}
            </ul>
            <button type="button" className={styles.addAgenda} onClick={() => setAgendaForm({ mode: 'new' })}>
              <Placeholder size={ICON_SIZE} />
              안건 추가하기
            </button>
          </section>

          <p className={styles.readiness}>
            <span>회의 준비</span>
            <span className={styles.divider} aria-hidden="true">
              <img src={dividerLine} alt="" width={21} height={1} />
            </span>
            <span className={styles.readinessState}>
              {readinessMessage(meeting.agendas.length > 0, Boolean(meeting.writer))}
            </span>
          </p>

          <div className={styles.startBlock}>
            <Button
              className={isStarting ? styles.startButtonBusy : undefined}
              disabled={!isReady || isStarting}
              onClick={() => setIsConsentOpen(true)}
            >
              {isStarting ? '회의 준비 중' : '회의 시작하기'}
            </Button>
            <p className={styles.startNote}>
              <Placeholder size={SMALL_ICON_SIZE} />
              회의 시작 시 녹음 및 전사 동의를 확인합니다.
            </p>
          </div>
        </div>

        <aside className={styles.side}>
          <section className={styles.attendees}>
            <div className={`${styles.attendeeHead} ${styles.menuAnchor}`}>
              <h2 className={styles.sideTitle}>회의 참여자</h2>
              <button
                ref={attendeeAnchorRef}
                type="button"
                className={styles.iconButton}
                aria-label="참여자 추가"
                aria-haspopup="listbox"
                aria-expanded={openMenu === 'attendee'}
                onClick={() => toggleMenu('attendee')}
              >
                <Placeholder size={ICON_SIZE} />
              </button>
              {openMenu === 'attendee' && (
                <DropdownMenu
                  label="참여자 추가"
                  emptyText="추가할 폴더 멤버가 없어요"
                  anchorRef={attendeeAnchorRef}
                  items={FOLDER_MEMBERS.filter(({ userId }) => !meeting.attendees.some((m) => m.userId === userId)).map(
                    (member) => ({ id: String(member.userId), label: member.name }),
                  )}
                  onSelect={(id) => {
                    const member = FOLDER_MEMBERS.find(({ userId }) => String(userId) === id);
                    if (member) {
                      addAttendee(member);
                    }
                  }}
                  onClose={closeMenu}
                />
              )}
            </div>
            <div className={styles.avatars}>
              {meeting.attendees.map((member) => (
                <Avatar key={member.userId} member={member} />
              ))}
            </div>
            <p className={styles.attendeeCount}>참여자 {meeting.attendees.length}명</p>
          </section>

          <img src={dividerSide} alt="" width={333} height={1} className={styles.sideDivider} />

          <section className={styles.minutesSettings}>
            <h2 className={styles.sideTitle}>회의록 설정</h2>
            <div className={styles.settingGroup}>
              <div className={styles.settingField}>
                <div className={styles.settingLabelRow}>
                  <span>회의록 양식</span>
                  <button type="button" className={styles.textButton} onClick={() => setTemplateModal({ view: 'gallery' })}>
                    전체보기
                  </button>
                </div>
                <div className={styles.menuAnchor}>
                  <button
                    ref={templateAnchorRef}
                    type="button"
                    className={styles.selectBox}
                    aria-haspopup="listbox"
                    aria-expanded={openMenu === 'template'}
                    onClick={() => toggleMenu('template')}
                  >
                    {selectedTemplate?.name ?? '양식 선택하기'}
                    <Placeholder size={ICON_SIZE} />
                  </button>
                  {openMenu === 'template' && (
                    <DropdownMenu
                      label="즐겨찾기한 회의록 양식"
                      emptyText="즐겨찾기한 양식이 없어요. 전체보기에서 즐겨찾기해 주세요"
                      anchorRef={templateAnchorRef}
                      items={templates
                        .filter(({ isFavorite }) => isFavorite)
                        .map((template) => ({
                          id: template.templateId,
                          label: template.name,
                          isSelected: template.templateId === meeting.templateId,
                        }))}
                      onSelect={(id) => {
                        updateMeeting({ templateId: id });
                        closeMenu();
                      }}
                      onClose={closeMenu}
                    />
                  )}
                </div>
                <p className={styles.settingCaption}>즐겨찾기한 회의록에서 선택 가능합니다.</p>
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
                    onClick={() => toggleMenu('writer')}
                  >
                    {meeting.writer?.name ?? '작성자 선택하기'}
                    <Placeholder size={ICON_SIZE} />
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
                        updateMeeting({ writer: meeting.attendees.find(({ userId }) => String(userId) === id) });
                        closeMenu();
                      }}
                      onClose={closeMenu}
                    />
                  )}
                </div>
                <p className={styles.settingCaption}>회의 참여자 중 한 명을 선택합니다.</p>
              </div>
            </div>
          </section>

          <img src={dividerSide} alt="" width={333} height={1} className={styles.sideDivider} />

          <section className={styles.materials}>
            <div className={styles.materialsHead}>
              <h2 className={styles.materialsTitle}>사전 자료</h2>
              <p className={styles.materialsCaption}>회의 전 필요한 자료들을 공유해요.</p>
            </div>
            {meeting.materials.length > 0 && (
              <ul className={styles.materialList}>
                {meeting.materials.map((name, index) => (
                  <li key={`${name}-${index}`}>{name}</li>
                ))}
              </ul>
            )}
            <button type="button" className={styles.addMaterial} onClick={() => fileInputRef.current?.click()}>
              <Placeholder size={MATERIAL_ICON_SIZE} />
              자료 추가하기
            </button>
            <input ref={fileInputRef} type="file" multiple hidden onChange={addMaterials} />
          </section>

          <button type="button" className={styles.cancelMeeting} onClick={() => setIsCancelDialogOpen(true)}>
            회의 취소하기
          </button>
        </aside>
      </div>

      {templateModal?.view === 'gallery' && (
        <TemplateGalleryModal
          templates={templates}
          selectedId={meeting.templateId}
          onOpenDetail={(index) => setTemplateModal({ view: 'detail', index })}
          onToggleFavorite={toggleFavorite}
          onCreateTemplate={() => setToast({ text: NEW_TEMPLATE_PENDING_MESSAGE, variant: 'info' })}
          onClose={() => setTemplateModal(null)}
        />
      )}
      {templateModal?.view === 'detail' && (
        <TemplateDetailModal
          templates={templates}
          index={templateModal.index}
          onChangeIndex={(index) => setTemplateModal({ view: 'detail', index })}
          onUse={(templateId) => {
            updateMeeting({ templateId });
            setTemplateModal(null);
          }}
          onClose={() => setTemplateModal({ view: 'gallery' })}
        />
      )}
      {isConsentOpen && <ConsentModal onCancel={() => setIsConsentOpen(false)} onAgree={startMeeting} />}
      {isStarting && <StartingModal />}
      {isCancelDialogOpen && (
        <ConfirmDialog
          title="회의를 취소할까요?"
          message={'취소하면 참석자에게 알림이 가고\n되돌릴 수 없어요.'}
          cancelLabel="돌아가기"
          confirmLabel="회의 취소"
          onCancel={() => setIsCancelDialogOpen(false)}
          onConfirm={cancelMeeting}
        />
      )}
    </AppLayout>
  );
}
