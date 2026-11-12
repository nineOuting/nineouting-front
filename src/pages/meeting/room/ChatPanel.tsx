import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { askChat, getChat, type ChatBasis, type ChatCitation, type ChatMessage } from '../../../api/chat';
import { errorMessage } from '../../../api/client';
import summaryIcon from '../../../assets/icons/summary.svg';
import Icon from '../../../components/Icon';
import Spinner from '../../../components/Spinner';
import room from './room.module.css';
import side from './SidePanel.module.css';
import styles from './ChatPanel.module.css';

const TITLE_ICON_SIZE = 24;
const EMPTY_ICON_SIZE = 48;
const SPINNER_SIZE = 16;
const MAX_QUERY = 1000;
// MSG-077
const FAILED_MESSAGE = '답을 만들지 못했어요. 잠시 뒤 다시 질문해 주세요.';
const GENERAL_MARK = '[일반]';

const BASIS_LABELS: Record<ChatBasis, string> = {
  sources: '회의 자료 기반',
  general: '일반 지식',
  mixed: '회의 자료와 일반 지식',
};

interface ChatPanelProps {
  meetingId: number;
  /** 진행 중인 회의에서만 질문한다 (REQ-185) */
  canAsk: boolean;
}

/** 답 글의 [n]은 근거 번호, [일반]은 일반 지식 표시, **글**은 굵게 보여 준다 */
function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\]|\[일반\]|\*\*[^*]+\*\*)/);
  return (
    <p className={side.text}>
      {parts.map((part, index) => {
        const ref = /^\[(\d+)\]$/.exec(part);
        if (ref) {
          return (
            <sup key={index} className={styles.ref}>
              {ref[1]}
            </sup>
          );
        }
        if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part === GENERAL_MARK) {
          return (
            <span key={index} className={styles.generalMark}>
              일반 지식
            </span>
          );
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </p>
  );
}

function Citations({ citations }: { citations: ChatCitation[] }) {
  if (citations.length === 0) {
    return null;
  }
  return (
    <ol className={styles.citations} aria-label="근거">
      {citations.map((citation) => (
        <li key={citation.ref} className={styles.citation}>
          <span className={styles.citationRef}>{citation.ref}</span>
          <span className={styles.citationSource}>
            {citation.title}
            {citation.location.label && <span className={styles.citationLabel}> {citation.location.label}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** REQ-185, 186 회의 중 챗봇 (임시 디자인). 내 대화만 보이고, 새로고침해도 남는다 */
export default function ChatPanel({ meetingId, canAsk }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [query, setQuery] = useState('');
  const [asking, setAsking] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCurrent = true;
    getChat(meetingId)
      .then((items) => isCurrent && setMessages(items))
      .catch((caught: unknown) => {
        if (isCurrent) {
          setMessages([]);
          setLoadError(errorMessage(caught));
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [meetingId]);

  // 새 대화가 생기면 맨 아래로
  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages, asking, failed]);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || asking) {
      return;
    }
    setAsking(trimmed);
    setFailed(null);
    setQuery('');
    try {
      const result = await askChat(meetingId, trimmed);
      if (result.status === 'failed' || !result.question || !result.answer) {
        setFailed(trimmed);
      } else {
        const { question, answer } = result;
        setMessages((prev) => [...(prev ?? []), question, answer]);
      }
    } catch {
      setFailed(trimmed);
    } finally {
      setAsking(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(query);
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter는 줄바꿈, Enter는 보내기 (한글 조합 중에는 보내지 않는다)
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void ask(query);
    }
  };

  const isEmpty = messages !== null && messages.length === 0 && !asking && !failed;

  return (
    <>
      <div className={side.head}>
        <div className={room.titleRow}>
          <Icon src={summaryIcon} size={TITLE_ICON_SIZE} className={room.titleIcon} />
          <h2 className={room.title}>챗봇</h2>
        </div>
        <p className={room.caption}>지난 회의록, 사전 자료, 지금 회의 내용으로 답해요</p>
      </div>
      <div className={side.divider} />

      <div ref={listRef} className={styles.messages} aria-live="polite">
        {messages === null && (
          <div className={room.empty}>
            <Spinner size={SPINNER_SIZE} />
          </div>
        )}
        {isEmpty && (
          <div className={room.empty}>
            <Icon src={summaryIcon} size={EMPTY_ICON_SIZE} className={room.emptyIcon} />
            <p className={room.emptyTitle}>무엇이든 물어보세요</p>
            <p className={room.emptyCaption}>예: 지난 회의에서 배포 날짜를 언제로 정했지?</p>
            {loadError && <p className={room.fieldError}>{loadError}</p>}
          </div>
        )}
        {messages?.map((message) =>
          message.role === 'USER' ? (
            <div key={message.messageId} className={styles.question}>
              {message.text}
            </div>
          ) : (
            <div key={message.messageId} className={styles.answer}>
              {message.status === 'answered' && message.basis && (
                <span className={styles.basis}>{BASIS_LABELS[message.basis]}</span>
              )}
              {/* MSG-076은 ai-service가 답 글로 준다 */}
              <AnswerText text={message.text} />
              <Citations citations={message.citations} />
            </div>
          ),
        )}
        {(asking ?? failed) && <div className={styles.question}>{asking ?? failed}</div>}
        {asking && (
          <div className={`${styles.answer} ${styles.pending}`}>
            <Spinner size={SPINNER_SIZE} />
            답을 찾고 있어요
          </div>
        )}
        {failed && !asking && (
          <div className={`${styles.answer} ${styles.failed}`} role="alert">
            <p className={side.text}>{FAILED_MESSAGE}</p>
            <button type="button" className={styles.retry} onClick={() => void ask(failed)}>
              다시 묻기
            </button>
          </div>
        )}
      </div>

      <form className={styles.form} onSubmit={submit}>
        <textarea
          className={styles.input}
          aria-label="챗봇에게 질문"
          placeholder={canAsk ? '질문을 입력하세요 (Enter로 보내기)' : '회의가 진행 중일 때만 질문할 수 있어요'}
          value={query}
          maxLength={MAX_QUERY}
          disabled={!canAsk}
          rows={2}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={keyDown}
        />
        <button type="submit" className={styles.send} disabled={!canAsk || !query.trim() || asking !== null}>
          보내기
        </button>
      </form>
    </>
  );
}
