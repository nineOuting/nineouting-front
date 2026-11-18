import { Fragment, useState } from 'react';
import termIcon from '../../../assets/icons/info.svg';
import Icon from '../../../components/Icon';
import { splitByTerms, type TermMatcher } from './termGlossary';
import styles from './TermText.module.css';

interface TermTextProps {
  text: string;
  /** 받은 용어 목록으로 만든 찾기 (REQ-191) */
  matcher: TermMatcher;
  /** 용어 카드의 [더 묻기] */
  onAsk?: (term: string) => void;
}

/** 전사 한 줄에서 용어를 파랗게 칠하고, 마우스를 올리면 뜻 카드를 띄운다 (Live_24) */
export default function TermText({ text, matcher, onAsk }: TermTextProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const parts = splitByTerms(text, matcher);

  return (
    <>
      {parts.map(({ text: part, card }, index) =>
        card ? (
          <span
            key={index}
            className={styles.term}
            onMouseEnter={() => setOpenIndex(index)}
            onMouseLeave={() => setOpenIndex(null)}
          >
            {part}
            {openIndex === index && (
              <span className={styles.card} role="tooltip">
                <span className={styles.cardTitle}>
                  <Icon src={termIcon} size={14} />
                  {card.title}
                </span>
                <span className={styles.cardText}>{card.text}</span>
                <span className={styles.cardFooter}>
                  <span>내 도우미에 저장됐어요</span>
                  {onAsk && (
                    <button type="button" className={styles.ask} onClick={() => onAsk(card.term)}>
                      더 묻기
                    </button>
                  )}
                </span>
              </span>
            )}
          </span>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
