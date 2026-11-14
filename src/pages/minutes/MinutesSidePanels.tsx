import { useEffect, useRef, useState } from 'react';
import type { AgendaStatusCode } from '../../api/meeting';
import checkIcon from '../../assets/icons/check.svg';
import chevronDownIcon from '../../assets/icons/chevron-down.svg';
import chevronLeftIcon from '../../assets/icons/chevron-left.svg';
import chevronRightIcon from '../../assets/icons/chevron-right.svg';
import chevronUpIcon from '../../assets/icons/chevron-up-sm.svg';
import pauseIcon from '../../assets/icons/pause.svg';
import summaryIcon from '../../assets/icons/summary.svg';
import transcriptIcon from '../../assets/icons/transcript.svg';
import Icon from '../../components/Icon';
import type { TranscriptLine } from '../../types/meetingRoom';
import styles from './MinutesSidePanels.module.css';

const TITLE_ICON_SIZE = 20;
const NAV_ICON_SIZE = 20;
const STATUS_ICON_SIZE = 12;

/** 디자인 Version02 결정현황 한 줄 */
export interface AgendaDecision {
  id: string;
  title: string;
  status: AgendaStatusCode;
  text: string;
  evidenceSeqs: number[];
}

/** REQ-133 안건별 요약 (안건 보드) */
export interface AgendaSummary {
  id: string;
  title: string;
  summary: string[];
  /** 주요 의견 (의견·근거) */
  opinions?: string[];
  status?: AgendaStatusCode;
  decisions?: AgendaDecision[];
  /** 아직 합의되지 않은 부분 (우려·질문) */
  openIssues?: string[];
}

interface MinutesSidePanelsProps {
  agendas: AgendaSummary[];
  lines: TranscriptLine[];
}

const DECISION_LABELS: Record<AgendaStatusCode, string> = {
  DECIDED: '',
  UNDECIDED: '미결',
  DECISION_CHECK: '확인 필요',
  DISCUSSING: '논의 중',
  NOT_STARTED: '논의 전',
};

/** 안건 고르기 목록의 작은 상태 글 (결정됨 / 미결 N개 / 논의 전) */
function agendaStateLabel(agenda: AgendaSummary) {
  const undecided = agenda.decisions?.filter(({ status }) => status === 'UNDECIDED').length ?? 0;
  if (undecided > 0) {
    return `미결 ${undecided}개`;
  }
  if (agenda.status === 'DECIDED' || (agenda.decisions?.length && agenda.decisions.every(({ status }) => status === 'DECIDED'))) {
    return '결정됨';
  }
  return agenda.status === 'NOT_STARTED' ? '논의 전' : '논의함';
}

/**
 * REQ-133~134 디자인 Version02 MinutesEditor 오른쪽: 회의 요약본(안건을 골라 요약·주요 의견·결정현황·합의되지 않은 부분)
 * + 전사 기록(접고 펼치기). 결정현황의 [근거 발언 보기]를 누르면 전사에서 근거 줄을 칠하고 그쪽으로 옮긴다
 */
export default function MinutesSidePanels({ agendas, lines }: MinutesSidePanelsProps) {
  const [index, setIndex] = useState(0);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(true);
  const [highlighted, setHighlighted] = useState<number[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef(new Map<number, HTMLLIElement>());
  const current = agendas[Math.min(index, agendas.length - 1)];
  const opinions = current?.opinions ?? [];
  const decisions = current?.decisions ?? [];
  const openIssues = current?.openIssues ?? [];
  const decidedCount = decisions.filter(({ status }) => status === 'DECIDED').length;

  useEffect(() => {
    if (!isPickerOpen) {
      return undefined;
    }
    const close = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [isPickerOpen]);

  const showEvidence = (seqs: number[]) => {
    setHighlighted(seqs);
    setIsTranscriptOpen(true);
    // 펼친 뒤 그려진 첫 근거 줄로 옮긴다
    window.requestAnimationFrame(() => lineRefs.current.get(seqs[0])?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  };

  return (
    <div className={styles.panels}>
      <section
        className={[styles.summarySection, isTranscriptOpen ? '' : styles.grow].filter(Boolean).join(' ')}
        aria-labelledby="minutes-summary-title"
      >
        <h2 id="minutes-summary-title" className={styles.title}>
          <Icon src={summaryIcon} size={TITLE_ICON_SIZE} className={styles.titleIcon} />
          회의 요약본
        </h2>
        {!current ? (
          <p className={styles.empty}>정리된 요약이 없어요.</p>
        ) : (
          <div className={styles.body}>
            <div className={styles.agendaPicker}>
              <div className={styles.pickerHead}>
                <span className={styles.label}>안건</span>
                <span className={styles.counter}>
                  {index + 1} / {agendas.length}
                </span>
              </div>
              <div className={styles.pickerRow}>
                <div ref={pickerRef} className={styles.selectAnchor}>
                  <button
                    type="button"
                    className={[styles.selectBox, isPickerOpen ? styles.selectOpen : ''].filter(Boolean).join(' ')}
                    aria-haspopup="listbox"
                    aria-expanded={isPickerOpen}
                    aria-label="요약을 볼 안건"
                    onClick={() => setIsPickerOpen((open) => !open)}
                  >
                    <span className={styles.selectValue}>{current.title}</span>
                    <Icon src={isPickerOpen ? chevronUpIcon : chevronDownIcon} size={NAV_ICON_SIZE} className={styles.selectIcon} />
                  </button>
                  {isPickerOpen && (
                    <ul className={styles.pickerMenu} role="listbox" aria-label="안건">
                      {agendas.map((agenda, agendaIndex) => {
                        const label = agendaStateLabel(agenda);
                        return (
                          <li key={agenda.id} role="option" aria-selected={agendaIndex === index}>
                            <button
                              type="button"
                              className={[styles.pickerItem, agendaIndex === index ? styles.pickerSelected : ''].filter(Boolean).join(' ')}
                              onClick={() => {
                                setIndex(agendaIndex);
                                setIsPickerOpen(false);
                              }}
                            >
                              <span className={[styles.pickerDot, label === '결정됨' ? styles.pickerDotFilled : ''].filter(Boolean).join(' ')} />
                              <span className={styles.pickerTexts}>
                                <span className={styles.pickerState}>{label}</span>
                                <span className={styles.pickerTitle}>
                                  {agendaIndex + 1}. {agenda.title}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.navButton}
                  aria-label="이전 안건"
                  disabled={index === 0}
                  onClick={() => setIndex((value) => value - 1)}
                >
                  <Icon src={chevronLeftIcon} size={NAV_ICON_SIZE} />
                </button>
                <button
                  type="button"
                  className={styles.navButton}
                  aria-label="다음 안건"
                  disabled={index >= agendas.length - 1}
                  onClick={() => setIndex((value) => value + 1)}
                >
                  <Icon src={chevronRightIcon} size={NAV_ICON_SIZE} />
                </button>
              </div>
            </div>
            <div className={styles.block}>
              <p className={styles.label}>안건 요약</p>
              <p className={styles.text}>
                {current.summary.length > 0 ? current.summary.join(' ') : '이 안건은 정리된 요약이 없어요.'}
              </p>
            </div>
            {opinions.length > 0 && (
              <div className={styles.block}>
                <p className={styles.label}>주요 의견</p>
                <ul className={styles.bullets}>
                  {opinions.map((opinion) => (
                    <li key={opinion}>{opinion}</li>
                  ))}
                </ul>
              </div>
            )}
            {decisions.length > 0 && (
              <div className={styles.block}>
                <div className={styles.blockHead}>
                  <p className={styles.label}>결정현황</p>
                  <span className={styles.counter}>
                    {decisions.length}개 중 {decidedCount}개 결정
                  </span>
                </div>
                <ul className={styles.decisions}>
                  {decisions.map((decision) => (
                    <li key={decision.id} className={`${styles.decision} ${styles[`decision_${decision.status}`] ?? ''}`}>
                      <span className={styles.decisionIcon} aria-hidden="true">
                        {decision.status === 'DECIDED' && <Icon src={checkIcon} size={STATUS_ICON_SIZE} />}
                        {decision.status === 'UNDECIDED' && <Icon src={pauseIcon} size={STATUS_ICON_SIZE - 2} />}
                      </span>
                      <span className={styles.decisionTexts}>
                        <span className={styles.decisionTitle}>
                          {decision.title}
                          {DECISION_LABELS[decision.status] && (
                            <span className={styles.decisionState}>{DECISION_LABELS[decision.status]}</span>
                          )}
                        </span>
                        {(decision.text || decision.evidenceSeqs.length > 0) && (
                          <span className={styles.decisionText}>
                            {decision.status === 'DECIDED' && decision.text}
                            {decision.evidenceSeqs.length > 0 && (
                              <button type="button" className={styles.evidenceLink} onClick={() => showEvidence(decision.evidenceSeqs)}>
                                근거 발언 보기
                              </button>
                            )}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {openIssues.length > 0 && (
              <div className={styles.block}>
                <p className={styles.label}>아직 합의되지 않은 부분</p>
                <ul className={styles.bullets}>
                  {openIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section
        className={[styles.transcriptSection, isTranscriptOpen ? styles.grow : ''].filter(Boolean).join(' ')}
        aria-labelledby="minutes-transcript-title"
      >
        <div className={styles.transcriptHead}>
          <h2 id="minutes-transcript-title" className={styles.title}>
            <Icon src={transcriptIcon} size={TITLE_ICON_SIZE} className={styles.titleIcon} />
            전사 기록
          </h2>
          <button
            type="button"
            className={styles.navButton}
            aria-label={isTranscriptOpen ? '전사 기록 접기' : '전사 기록 펼치기'}
            aria-expanded={isTranscriptOpen}
            onClick={() => setIsTranscriptOpen((open) => !open)}
          >
            <Icon src={isTranscriptOpen ? chevronDownIcon : chevronUpIcon} size={NAV_ICON_SIZE} />
          </button>
        </div>
        {isTranscriptOpen &&
          (lines.length === 0 ? (
            <p className={styles.empty}>받아쓴 발언이 없어요.</p>
          ) : (
            <ol className={styles.lines}>
              {lines.map((line) => (
                <li
                  key={line.seq}
                  ref={(element) => {
                    if (element) {
                      lineRefs.current.set(line.seq, element);
                    } else {
                      lineRefs.current.delete(line.seq);
                    }
                  }}
                  className={[styles.line, highlighted.includes(line.seq) ? styles.lineHighlighted : ''].filter(Boolean).join(' ')}
                >
                  <span className={styles.time}>{line.time}</span>
                  <p className={styles.lineText}>{line.text}</p>
                </li>
              ))}
            </ol>
          ))}
      </section>
    </div>
  );
}
