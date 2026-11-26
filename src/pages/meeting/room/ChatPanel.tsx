import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { askChat, getChat, type ChatCitation, type ChatMessage } from '../../../api/chat';
import { errorMessage } from '../../../api/client';
import errorIcon from '../../../assets/icons/error.svg';
import liveIcon from '../../../assets/icons/evidence.svg';
import generalIcon from '../../../assets/icons/general-knowledge.svg';
import lockIcon from '../../../assets/icons/lock.svg';
import goIcon from '../../../assets/icons/source-go.svg';
import archiveIcon from '../../../assets/icons/nav-archive.svg';
import uploadIcon from '../../../assets/icons/pdf.svg';
import sendIcon from '../../../assets/icons/send.svg';
import suggestionIcon from '../../../assets/icons/ai-suggestion.svg';
import Icon from '../../../components/Icon';
import Spinner from '../../../components/Spinner';
import TermCard, { type TermCardItem } from './TermCard';
import room from './room.module.css';
import side from './SidePanel.module.css';
import styles from './ChatPanel.module.css';

const SPINNER_SIZE = 16;
const MAX_QUERY = 1000;
// MSG-077
const FAILED_MESSAGE = '답을 만들지 못했어요. 잠시 뒤 다시 질문해 주세요.';
const GENERAL_MARK = '[일반]';

const HEAD_ICON_SIZE = 14;
const SOURCE_GO_SIZE = 16;

// 디자인 AssistantAnswerCard: 답 카드 맨 위 "아이콘 + 어디서 찾았는지" 한 줄 (SCRUM-365).
// 지금 회의, 지난 회의, 찾지 못함은 디자인대로, 사전 자료, 일반 지식은 디자인에 없어 같은 모양으로 더했다
const SOURCE_HEADS: Record<ChatCitation['sourceType'], { label: string; icon: string }> = {
  live: { label: '지금 회의에서 찾았어요', icon: liveIcon },
  minutes: { label: '지난 회의에서 찾았어요', icon: archiveIcon },
  upload: { label: '사전 자료에서 찾았어요', icon: uploadIcon },
};
// 근거가 여러 곳에서 나오면 이 순서로 하나만 보여 준다
const SOURCE_ORDER: ChatCitation['sourceType'][] = ['live', 'minutes', 'upload'];
const NO_RESULT_HEAD = { label: '찾지 못했어요', icon: archiveIcon };
const GENERAL_HEAD = { label: '일반 지식으로 답했어요', icon: generalIcon };

/** 답 카드 머리 줄. 근거도 일반 지식도 아니면(예전 답 등) 보여 주지 않는다 */
function answerHead(message: ChatMessage) {
  if (message.status === 'no_result') {
    return NO_RESULT_HEAD;
  }
  if (message.basis === 'general') {
    return GENERAL_HEAD;
  }
  const source = SOURCE_ORDER.find((type) => message.citations.some(({ sourceType }) => sourceType === type));
  return source ? SOURCE_HEADS[source] : undefined;
}

interface ChatPanelProps {
  meetingId: number;
  /** 진행 중인 회의에서만 질문한다 (REQ-185) */
  canAsk: boolean;
  /** 입력칸 위 추천 질문 칩 (누르면 바로 묻는다) */
  suggestions?: string[];
  /** 처음 열 때 입력칸에 채울 질문 (용어 [더 묻기] 등) */
  initialQuery?: string;
  /** REQ-191 처음 나온 용어 카드. at(ms) 순서로 대화 사이에 끼워 넣는다 */
  termCards?: (TermCardItem & { at: number })[];
  /** 용어 카드의 "방금", "N분 전"을 셀 지금 시각 */
  now?: number;
  /** 지금 회의 근거를 누르면 그 전사 줄로 간다 */
  onOpenLine?: (seq: number) => void;
}

type ThreadItem = { at: number; message: ChatMessage; card?: never } | { at: number; card: TermCardItem; message?: never };

/** 대화와 용어 카드를 시간순으로. 시각이 같으면 용어 카드를 먼저 */
function toThread(messages: ChatMessage[], termCards: (TermCardItem & { at: number })[]): ThreadItem[] {
  const items: ThreadItem[] = [
    ...termCards.map(({ at, ...card }) => ({ at, card })),
    ...messages.map((message) => ({ at: Date.parse(message.createdAt), message })),
  ];
  return items.sort((a, b) => a.at - b.at);
}

const DEFAULT_SUGGESTIONS = ['방금 5분 요약해 줘', '지난 회의에서 비슷한 얘기 찾아줘'];

/**
 * 답 글의 [n](근거 번호)은 보여 주지 않는다. 디자인은 근거를 답 아래 인용으로만 보여 준다 (SourceQuote).
 * [일반]은 일반 지식 표시, **글**은 굵게 보여 준다. 답 전체가 일반 지식이면 머리 줄과 겹치므로 [일반] 표시는 숨긴다 (hideGeneral)
 */
function AnswerText({ text, hideGeneral = false }: { text: string; hideGeneral?: boolean }) {
  // 지우는 표시 앞 빈칸도 같이 지운다 ("나왔어요 [3][11]." → "나왔어요.", "단위예요 [일반]." → "단위예요.")
  const withoutRefs = text.replace(/\s*\[\d+\]/g, '');
  const shown = hideGeneral ? withoutRefs.replace(/\s*\[일반\]/g, '') : withoutRefs;
  const parts = shown.split(/(\[일반\]|\*\*[^*]+\*\*)/);
  return (
    <p className={side.text}>
      {parts.map((part, index) => {
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

function AnswerHead({ message }: { message: ChatMessage }) {
  const head = answerHead(message);
  if (!head) {
    return null;
  }
  return (
    <span className={styles.answerHead}>
      <Icon src={head.icon} size={HEAD_ICON_SIZE} />
      {head.label}
    </span>
  );
}

/** 지금 회의 근거의 전사 줄. 발언(time)은 그 줄, 안건 요약·의견(agenda)은 첫 근거 발언 */
function lineSeqOf({ sourceType, location }: ChatCitation) {
  if (sourceType !== 'live') {
    return undefined;
  }
  return location.seq ?? location.evidenceSeqs?.[0];
}

/** 인용 위 출처 이름. 지금 회의는 위치(발언 시각, 안건 요약 등), 지난 회의는 회의 이름, 사전 자료는 자료 이름과 쪽 */
function sourceNameOf({ sourceType, title, location }: ChatCitation) {
  if (sourceType === 'live') {
    return location.label || title;
  }
  if (sourceType === 'upload' && location.label) {
    return `${title} ${location.label}`;
  }
  return title;
}

/**
 * 디자인 SourceQuote (07 상태 모음 · 놓친 흐름 따라잡기, 지난 회의 찾아보기): 파란 막대, 출처 이름, 인용, 화살표.
 * 지금 회의 근거만 눌러 전사 줄로 간다. 지난 회의, 사전 자료는 갈 곳이 없어 화살표 없이 보여 준다
 */
function Sources({ citations, onOpenLine }: { citations: ChatCitation[]; onOpenLine?: (seq: number) => void }) {
  if (citations.length === 0) {
    return null;
  }
  return (
    <ul className={styles.sources} aria-label="근거">
      {citations.map((citation) => {
        const seq = lineSeqOf(citation);
        const body = (
          <>
            <span className={styles.sourceBar} aria-hidden="true" />
            <span className={styles.sourceText}>
              <span className={styles.sourceName}>{sourceNameOf(citation)}</span>
              {/* 디자인은 인용 한두 줄. 회의록 한 절처럼 긴 근거는 두 줄로 자르고, 마우스를 올리면 전체를 보여 준다 */}
              <span className={styles.sourceQuote} title={citation.text}>
                {citation.text}
              </span>
            </span>
          </>
        );
        return (
          <li key={citation.ref}>
            {seq !== undefined && onOpenLine ? (
              <button
                type="button"
                className={`${styles.source} ${styles.sourceLink}`}
                aria-label={`${sourceNameOf(citation)} 전사 줄로 가기`}
                onClick={() => onOpenLine(seq)}
              >
                {body}
                <Icon src={goIcon} size={SOURCE_GO_SIZE} />
              </button>
            ) : (
              <div className={styles.source}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** REQ-185, 186 회의 중 챗봇 (임시 디자인). 내 대화만 보이고, 새로고침해도 남는다 */
export default function ChatPanel({
  meetingId,
  canAsk,
  suggestions = DEFAULT_SUGGESTIONS,
  initialQuery,
  termCards = [],
  now = 0,
  onOpenLine,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [query, setQuery] = useState(initialQuery ?? '');
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
  }, [messages, asking, failed, termCards.length]);

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

  const isEmpty = messages !== null && messages.length === 0 && termCards.length === 0 && !asking && !failed;

  return (
    <>
      <div ref={listRef} className={styles.messages} aria-live="polite">
        {messages === null && (
          <div className={room.empty}>
            <Spinner size={SPINNER_SIZE} />
          </div>
        )}
        {isEmpty && (
          // 디자인 Live_19 넵넵 AI 처음 열기 (2026-11-18 이름 바뀜)
          <div className={styles.intro}>
            <span className={styles.privateChip}>
              <Icon src={lockIcon} size={12} />
              나만 보여요
            </span>
            <p className={styles.introTitle}>나만 보는 넵넵 AI예요</p>
            <p className={styles.introText}>
              다른 참석자에게 보이지 않으니 편하게 물어보세요. 놓친 내용과 용어를 바로 알려드려요.
            </p>
            {loadError && <p className={room.fieldError}>{loadError}</p>}
          </div>
        )}
        {messages !== null &&
          toThread(messages, termCards).map(({ message, card }) =>
          !message ? (
            <TermCard key={`term-${card.id}`} card={card} now={now} />
          ) : message.role === 'USER' ? (
            <div key={message.messageId} className={styles.question}>
              {message.text}
            </div>
          ) : (
            <div key={message.messageId} className={styles.answer}>
              <AnswerHead message={message} />
              {/* MSG-076은 ai-service가 답 글로 준다 */}
              <AnswerText text={message.text} hideGeneral={message.basis === 'general'} />
              <Sources citations={message.citations} onOpenLine={onOpenLine} />
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
          // 디자인 Card 넵넵이가 답을 못 만듦: 흰 카드, 위에 작은 아이콘과 "답을 만들지 못했어요" (디자인 체크 2026-11-19)
          <div className={`${styles.answer} ${styles.failed}`} role="alert">
            <span className={styles.answerHead}>
              <Icon src={errorIcon} size={HEAD_ICON_SIZE} />
              답을 만들지 못했어요
            </span>
            <p className={side.text}>{FAILED_MESSAGE}</p>
            <button type="button" className={styles.retry} onClick={() => void ask(failed)}>
              다시 묻기
            </button>
          </div>
        )}
      </div>

      {canAsk && suggestions.length > 0 && (
        <div className={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className={styles.suggestion}
              disabled={asking !== null}
              onClick={() => void ask(suggestion)}
            >
              <Icon src={suggestionIcon} size={12} />
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <form className={styles.form} onSubmit={submit}>
        <textarea
          className={styles.input}
          aria-label="넵넵 AI에게 질문"
          placeholder={canAsk ? '회의 내용, 지난 회의, 용어를 물어보세요' : '회의가 진행 중일 때만 질문할 수 있어요'}
          value={query}
          maxLength={MAX_QUERY}
          disabled={!canAsk}
          rows={1}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={keyDown}
        />
        <button
          type="submit"
          className={styles.send}
          aria-label="보내기"
          disabled={!canAsk || !query.trim() || asking !== null}
        >
          <Icon src={sendIcon} size={16} />
        </button>
      </form>
    </>
  );
}
