import { useState, type ReactNode } from 'react';
import infoIcon from '../../../assets/icons/info.svg';
import Button from '../../../components/Button';
import Checkbox from '../../../components/Checkbox';
import Dialog from '../../../components/Dialog';
import Icon from '../../../components/Icon';
import Spinner from '../../../components/Spinner';
import type { RoomAgenda } from '../../../types/meetingRoom';
import StatusPill from './StatusPill';
import styles from './EndMeetingModal.module.css';

export type EndStep = 'waiting' | 'leftover' | 'confirm';

interface EndMeetingModalProps {
  step: EndStep;
  /** REQ-093 결론이 나지 않은 안건 */
  leftover: RoomAgenda[];
  /** MSG-083 회의록을 만들 양식 이름. 대기 화면에서 고르지 않았으면 null */
  templateName: string | null;
  isBusy: boolean;
  /**
   * viewer: 회의록 작성자가 아닌 참석자. 작성자가 회의를 끝내는 동안 기다림 안내만 본다.
   * 닫으면 onContinue 대신 onClose를 부른다
   */
  isViewer?: boolean;
  /** REQ-095 이어서 논의하기 (양식 확인 창의 [취소]도 같다) */
  onContinue: () => void;
  /** REQ-094 고른 안건을 다음 회의로 넘기고 양식 확인으로 */
  onCarryOver: (agendaIds: string[]) => void;
  /** REQ-098 마무리 */
  onFinish: () => void;
  onClose?: () => void;
}

const INFO_ICON_SIZE = 16;
const SPINNER_SIZE = 20;

const TITLES: Record<EndStep, { title: string; description: string }> = {
  waiting: { title: '회의를 정리하고 있어요', description: '방금 나온 말까지 반영해 결론이 나지 않은 안건을 찾고 있어요' },
  leftover: { title: '회의를 끝낼까요?', description: '결론이 나지 않은 안건이 있어요. 다음 회의로 넘길 안건을 골라 주세요.' },
  confirm: { title: '회의록 양식 확인', description: '' },
};

/** 디자인 InlineAlert (info) */
function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className={styles.note}>
      <Icon src={infoIcon} size={INFO_ICON_SIZE} />
      {children}
    </p>
  );
}

/** MSG-083 회의록 양식 확인. 디자인 Card 회의록 양식 확인: 양식 이름은 제목에, 설명은 한 줄 (디자인 체크 2026-11-19) */
function confirmTitle(templateName: string | null) {
  return templateName ? `'${templateName}' 양식으로 회의록을 만들어요` : TITLES.confirm.title;
}

function confirmMessage(templateName: string | null) {
  return templateName
    ? '[확인]을 누르면 녹음이 멈추고 회의록을 만들기 시작해요'
    : '[확인]을 누르면 녹음이 멈추고 회의록을 만들기 시작해요. 양식은 회의록 작성 화면에서 골라 주세요.';
}

/**
 * REQ-093~098 회의 끝내기: 정리 기다림 → 결론 나지 않은 안건 → 회의록 양식 확인(MSG-083) → 회의록 작성 화면.
 * 2026-11-17 기획 결정으로 오늘 회의 요약 단계(REQ-097)는 뺐다
 */
export default function EndMeetingModal({
  step,
  leftover,
  templateName,
  isBusy,
  isViewer = false,
  onContinue,
  onCarryOver,
  onFinish,
  onClose,
}: EndMeetingModalProps) {
  // 처음에는 모두 다음 회의로 넘기는 쪽으로 골라 둔다
  const [selected, setSelected] = useState<string[]>(() => leftover.map(({ id }) => id));

  const toggle = (agendaId: string) =>
    setSelected((prev) => (prev.includes(agendaId) ? prev.filter((id) => id !== agendaId) : [...prev, agendaId]));

  const continueButton = (label: string) => (
    <Button type="button" variant="secondary" size="md" disabled={isBusy} onClick={onContinue}>
      {label}
    </Button>
  );
  const footer: Record<EndStep, ReactNode> = {
    waiting: (
      <>
        {continueButton('이어서 논의하기')}
        <Button isLoading={isBusy} type="button" variant="primary" size="md" disabled={isBusy} onClick={onFinish}>
          바로 회의 끝내기
        </Button>
      </>
    ),
    leftover: (
      <>
        {continueButton('이어서 논의하기')}
        <Button isLoading={isBusy} type="button" variant="primary" size="md" disabled={isBusy} onClick={() => onCarryOver(selected)}>
          회의 끝내기
        </Button>
      </>
    ),
    confirm: (
      <>
        {continueButton('취소')}
        <Button isLoading={isBusy} type="button" variant="primary" size="md" disabled={isBusy} onClick={onFinish}>
          확인
        </Button>
      </>
    ),
  };

  if (isViewer) {
    return (
      <Dialog
        title="회의를 정리하고 있어요"
        description="회의록 작성자가 회의를 끝내려고 해요"
        width="md"
        onClose={onClose ?? (() => undefined)}
        footer={
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            닫기
          </Button>
        }
      >
        <div className={styles.body}>
          <p className={styles.waiting}>
            <Spinner size={SPINNER_SIZE} />
            작성자가 회의를 정리하고 있어요
          </p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={step === 'confirm' ? confirmTitle(templateName) : TITLES[step].title}
      description={
        step === 'leftover'
          ? `결론이 나지 않은 안건이 ${leftover.length}개 있어요. 다음 회의로 넘길 안건을 골라 주세요.`
          : step === 'confirm'
            ? confirmMessage(templateName)
            : TITLES[step].description
      }
      // 디자인 EndMeetingModal: 뒤로가기 없이 X와 [이어서 논의하기]로 돌아간다 (디자인 체크 2026-11-19)
      width="md"
      hideClose={isBusy}
      onClose={isBusy ? () => undefined : onContinue}
      footer={footer[step]}
    >
      {step !== 'confirm' && (
        <div className={styles.body}>
          {step === 'waiting' && (
            <p className={styles.waiting}>
              <Spinner size={SPINNER_SIZE} />
              회의 내용을 정리하는 중이에요
            </p>
          )}

          {step === 'leftover' && (
            <>
              <ul className={styles.agendaList}>
                {leftover.map((agenda) => (
                  // 디자인 AgendaCheckItem: 체크, 제목과 한 줄 설명, 오른쪽 상태 배지
                  <li key={agenda.id} className={styles.agenda}>
                    <Checkbox
                      className={styles.agendaHead}
                      checked={selected.includes(agenda.id)}
                      disabled={isBusy}
                      onChange={() => toggle(agenda.id)}
                    >
                      <span className={styles.agendaText}>
                        <span className={styles.agendaTitle}>{agenda.title}</span>
                        <span className={styles.agendaSummary}>
                          {agenda.summary.length > 0 ? agenda.summary.join(' ') : '아직 이야기하지 않았어요'}
                        </span>
                      </span>
                      <StatusPill status={agenda.status} soft />
                    </Checkbox>
                  </li>
                ))}
              </ul>
              <InfoNote>고른 안건은 폴더의 "남은 안건"에 저장돼요. 회의를 끝내면 녹음이 멈추고 회의록 초안을 만들어요</InfoNote>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
