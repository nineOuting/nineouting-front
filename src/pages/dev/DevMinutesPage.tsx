import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isApiError } from '../../api/client';
import {
  getAiStatus,
  getTodaySummary,
  requestMinutesDraft,
  type AiStatus,
  type TodaySummary,
} from '../../api/devMinutes';
import { getMinutesByMeeting, type MinutesDetail } from '../../api/minutes';
import Button from '../../components/Button';
import { API_LOG_CHANNEL, type ApiLogEntry } from '../../dev/apiLog';
import styles from './DevMinutesPage.module.css';

const POLL_MS = 3000;

interface Snapshot {
  at: string;
  summary: TodaySummary | null;
  minutes: MinutesDetail | null;
  ai: AiStatus | null;
  summaryError: string | null;
  minutesError: string | null;
  aiError: string | null;
}

interface LogEntry {
  at: string;
  name: string;
  from: string | null;
  to: string;
}

function describeError(error: unknown) {
  if (isApiError(error)) {
    return `${error.status} ${error.code} ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

function settledValue<T>(result: PromiseSettledResult<T>) {
  return result.status === 'fulfilled' ? result.value : null;
}

function settledError<T>(result: PromiseSettledResult<T>) {
  return result.status === 'rejected' ? describeError(result.reason) : null;
}

async function readSnapshot(meetingId: number): Promise<Snapshot> {
  const [summary, minutes, ai] = await Promise.allSettled([
    getTodaySummary(meetingId),
    getMinutesByMeeting(meetingId),
    getAiStatus(meetingId),
  ]);
  return {
    at: new Date().toISOString(),
    summary: settledValue(summary),
    minutes: settledValue(minutes),
    ai: settledValue(ai),
    summaryError: settledError(summary),
    minutesError: settledError(minutes),
    aiError: settledError(ai),
  };
}

/** 기록에 남길 값. 이전 조회와 달라진 항목만 기록한다 */
function signals({ summary, minutes, ai, summaryError, minutesError, aiError }: Snapshot): Record<string, string> {
  return {
    '요약 final': summary ? String(summary.final) : '-',
    '요약 값': summary ? (summary.todaySummary === null ? '없음' : '있음') : '-',
    draftStatus: minutes ? String(minutes.draftStatus) : '-',
    draftError: minutes ? String(minutes.draftError) : '-',
    '칸별 글자 수': minutes ? minutes.sections.map(({ content }) => content.length).join(' / ') : '-',
    'ai 회의 상태': ai?.status ?? '-',
    'ai 대기열': ai ? String(ai.queued) : '-',
    'ai 요약 생성': ai?.agendaTodaySummary ? String(ai.agendaTodaySummary.built) : '-',
    'ai 오류 수': ai ? String(ai.errors) : '-',
    '요약 조회 오류': summaryError ?? '없음',
    '회의록 조회 오류': minutesError ?? '없음',
    'ai 조회 오류': aiError ?? '없음',
  };
}

/** 409는 저장되지 않아 draftStatus가 비어 있다. 요약 도착 여부와 묶어서 지금 단계를 판단한다 */
function stageOf({ summary, minutes }: Snapshot) {
  if (!minutes) {
    return '회의록 없음';
  }
  switch (minutes.draftStatus) {
    case 'REQUESTED':
      return '초안 생성 중';
    case 'SUCCEEDED':
      return '초안 완료';
    case 'FAILED':
      return '초안 실패';
    default:
      return summary?.final ? '초안 요청 가능' : '요약 대기';
  }
}

/** 회의 작업별 호출 기록. 초안 호출은 회의 상태에 없어 여기 나오지 않는다 */
function aiWorks(ai: AiStatus) {
  return [
    { name: '실시간 요약', calls: ai.llmCalls },
    { name: '안건 분류', ...ai.agendaClassification },
    { name: '안건 요약', ...ai.agendaSummary },
    { name: '상태 판정', ...ai.agendaStatus },
    { name: '의견 정리', ...ai.agendaOpinions },
    { name: '할 일 추출', ...ai.agendaTodos },
    { name: '주제 이탈', ...ai.agendaOffTopic },
  ];
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour12: false });
}

function Field({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  return (
    <div className={styles.field}>
      <dt>{label}</dt>
      <dd>{value === null || value === undefined ? '-' : String(value)}</dd>
    </div>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  return message ? <p className={styles.error}>{message}</p> : null;
}

/** SCRUM-182 회의 종료부터 초안 생성까지 확인하는 개발 화면. 기록은 메모리에만 둔다 */
export default function DevMinutesPage() {
  const meetingId = Number(useParams().meetingId);
  if (!Number.isInteger(meetingId)) {
    return <main className={styles.page}>회의 번호가 올바르지 않습니다.</main>;
  }
  // 회의 번호가 바뀌면 기록을 새로 시작한다
  return <DevMinutesMonitor key={meetingId} meetingId={meetingId} />;
}

function DevMinutesMonitor({ meetingId }: { meetingId: number }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [aiBefore, setAiBefore] = useState<AiStatus | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [apiLog, setApiLog] = useState<ApiLogEntry[]>([]);
  // 기록은 뒤에만 붙으므로 배열 위치가 고정 번호가 된다
  const [selectedApiId, setSelectedApiId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const previousSignals = useRef<Record<string, string>>({});
  const previousAi = useRef<AiStatus | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const next = await readSnapshot(meetingId);
      if (!active) {
        return;
      }
      const current = signals(next);
      const changes = Object.entries(current)
        .filter(([name, value]) => previousSignals.current[name] !== value)
        .map(([name, to]) => ({ at: next.at, name, from: previousSignals.current[name] ?? null, to }));
      previousSignals.current = current;
      setAiBefore(previousAi.current);
      previousAi.current = next.ai;
      setSnapshot(next);
      if (changes.length > 0) {
        setLog((entries) => [...entries, ...changes]);
      }
      timer = setTimeout(() => void poll(), POLL_MS);
    }

    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [meetingId]);

  useEffect(() => {
    const channel = new BroadcastChannel(API_LOG_CHANNEL);
    channel.onmessage = (event: MessageEvent<ApiLogEntry>) => setApiLog((entries) => [...entries, event.data]);
    return () => channel.close();
  }, []);

  const addLog = useCallback((name: string, to: string) => {
    setLog((entries) => [...entries, { at: new Date().toISOString(), name, from: null, to }]);
  }, []);

  async function sendDraftRequest(minutes: MinutesDetail) {
    // 진행 중에 다시 요청하면 앞 요청의 결과가 버려진다
    if (minutes.draftStatus === 'REQUESTED' && !window.confirm('초안을 만드는 중입니다. 앞 요청의 결과를 버리고 다시 요청할까요?')) {
      return;
    }
    setSending(true);
    addLog('초안 재요청', '보냄');
    try {
      const result = await requestMinutesDraft(minutes.minutesId);
      addLog('초안 재요청 응답', `성공 draftStatus=${result.draftStatus}`);
    } catch (error) {
      addLog('초안 재요청 응답', describeError(error));
    } finally {
      setSending(false);
    }
  }

  function downloadLog() {
    const file = new Blob([JSON.stringify({ meetingId, savedAt: new Date().toISOString(), snapshot, log, apiLog }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dev-minutes-${meetingId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const selectedApi = selectedApiId === null ? null : apiLog[selectedApiId];
  const minutes = snapshot?.minutes ?? null;
  const ai = snapshot?.ai ?? null;
  const worksBefore = aiBefore ? aiWorks(aiBefore) : [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>회의록 초안 확인 (개발용)</h1>
          <p className={styles.caption}>
            회의 {meetingId}번 · {POLL_MS / 1000}초마다 조회
            {snapshot ? ` · 마지막 조회 ${timeOf(snapshot.at)}` : ''}
          </p>
        </div>
        <strong className={styles.stage}>{snapshot ? stageOf(snapshot) : '조회 중'}</strong>
      </header>

      <div className={styles.grid}>
        <section className={styles.wideCard}>
          <h2>API·소켓 기록 ({apiLog.length}건)</h2>
          <p className={styles.caption}>
            다른 탭의 프론트 화면이 주고받은 값입니다. 토큰·입장권·비밀번호는 가려집니다. 회의 시작 전에 이 탭을 열어 두세요.
          </p>
          <div className={styles.apiPanel}>
            <ol className={styles.apiList}>
              {apiLog
                .map((entry, id) => ({ entry, id }))
                .reverse()
                .map(({ entry: { at, label, status }, id }) => (
                  <li key={id}>
                    <button
                      type="button"
                      className={id === selectedApiId ? styles.apiItemSelected : styles.apiItem}
                      onClick={() => setSelectedApiId(id)}
                    >
                      <time>{timeOf(at)}</time> <b>{label}</b> {status}
                    </button>
                  </li>
                ))}
            </ol>
            <div className={styles.apiDetail}>
              {selectedApi ? (
                <>
                  <p>
                    <time>{timeOf(selectedApi.at)}</time> <b>{selectedApi.label}</b> {selectedApi.status}
                  </p>
                  {selectedApi.request !== undefined && (
                    <pre className={styles.apiCode}>보냄 {JSON.stringify(selectedApi.request, null, 2)}</pre>
                  )}
                  {selectedApi.response !== undefined && (
                    <pre className={styles.apiCode}>받음 {JSON.stringify(selectedApi.response, null, 2)}</pre>
                  )}
                </>
              ) : (
                <p className={styles.caption}>왼쪽에서 기록을 고르면 여기에 값이 나옵니다.</p>
              )}
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h2>ai-service (로컬 전용)</h2>
          <ErrorLine message={snapshot?.aiError ?? null} />
          <dl>
            <Field label="status" value={ai?.status} />
            <Field label="queued" value={ai?.queued} />
            <Field label="받은 묶음" value={ai?.received.batches} />
            <Field label="받은 줄" value={ai?.received.lines} />
            <Field label="분류 대기 줄" value={ai?.agendaClassification?.pending} />
            <Field label="errors" value={ai?.errors} />
            <Field label="요약 생성" value={ai?.agendaTodaySummary?.built} />
            <Field label="요약 실패" value={ai?.agendaTodaySummary?.failures} />
            <Field label="전송 실패" value={ai?.publisher?.failed} />
          </dl>
          {ai && (
            <table className={styles.workTable}>
              <thead>
                <tr>
                  <th>작업</th>
                  <th>호출</th>
                  <th>{POLL_MS / 1000}초간</th>
                  <th>오류</th>
                </tr>
              </thead>
              <tbody>
                {aiWorks(ai).map(({ name, calls, errors, halted }, index) => {
                  const added = calls === undefined ? 0 : calls - (worksBefore[index]?.calls ?? calls);
                  return (
                    <tr key={name} className={added > 0 ? styles.workActive : undefined}>
                      <td>
                        {name}
                        {halted ? ` (멈춤: ${halted})` : ''}
                      </td>
                      <td>{calls ?? '-'}</td>
                      <td>{added > 0 ? `+${added}` : ''}</td>
                      <td>{errors ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className={styles.caption}>
            지금 처리 중인 작업은 ai-service가 알려 주지 않아, 호출이 늘어난 줄로 짐작합니다. 실행 중인 작업은 queued에 잡히지 않고, 초안 호출은 이 표에 없습니다.
          </p>
        </section>

        <div className={styles.column}>
          <section className={styles.card}>
            <h2>회의 요약</h2>
            <ErrorLine message={snapshot?.summaryError ?? null} />
            <dl>
              <Field label="final" value={snapshot?.summary?.final} />
              <Field label="값" value={snapshot?.summary ? (snapshot.summary.todaySummary === null ? '없음' : '있음') : null} />
            </dl>
            <pre className={styles.summaryCode}>
              {snapshot?.summary?.todaySummary != null ? JSON.stringify(snapshot.summary.todaySummary, null, 2) : '(아직 없음)'}
            </pre>
          </section>

          <section className={styles.card}>
            <h2>초안</h2>
            <ErrorLine message={snapshot?.minutesError ?? null} />
            <dl>
              <Field label="회의록 번호" value={minutes?.minutesId} />
              <Field label="templateId" value={minutes?.templateId} />
              <Field label="draftStatus" value={minutes?.draftStatus} />
              <Field label="draftError" value={minutes?.draftError} />
            </dl>
            <Button disabled={!minutes || sending} onClick={() => minutes && void sendDraftRequest(minutes)}>
              {sending ? '요청 중' : '초안 재요청'}
            </Button>
          </section>
        </div>

        <section className={styles.card}>
          <h2>칸별 결과</h2>
          {minutes && minutes.sections.length > 0 ? (
            minutes.sections.map(({ sectionId, title, content }) => (
              <details key={sectionId} className={styles.section}>
                <summary>
                  {title} ({content.length}자)
                </summary>
                <pre className={styles.code}>{content || '(비어 있음)'}</pre>
              </details>
            ))
          ) : (
            <p className={styles.caption}>칸이 없습니다.</p>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.logHeader}>
            <h2>변경 기록</h2>
            <Button variant="secondary" disabled={log.length === 0} onClick={downloadLog}>
              JSON 내려받기
            </Button>
          </div>
          <p className={styles.caption}>이 화면을 연 뒤의 변경만 쌓이고, 새로고침하면 사라집니다.</p>
          <ol className={styles.log}>
            {[...log].reverse().map(({ at, name, from, to }, index) => (
              <li key={`${at}-${name}-${index}`}>
                <time>{timeOf(at)}</time> <b>{name}</b> {from === null ? to : `${from} → ${to}`}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
