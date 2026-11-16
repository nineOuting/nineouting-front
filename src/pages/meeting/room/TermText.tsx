import { Fragment, useState } from 'react';
import termIcon from '../../../assets/icons/info.svg';
import Icon from '../../../components/Icon';
import { GLOSSARY, TERM_PATTERN } from './termGlossary';
import styles from './TermText.module.css';

interface TermTextProps {
  text: string;
  /** 용어 카드의 [더 묻기] */
  onAsk?: (term: string) => void;
}

/** 전사 한 줄에서 용어를 파랗게 칠하고, 마우스를 올리면 뜻 카드를 띄운다 (Live_24) */
export default function TermText({ text, onAsk }: TermTextProps) {
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const parts = text.split(TERM_PATTERN);

  return (
    <>
      {parts.map((part, index) =>
        GLOSSARY[part] ? (
          <span
            key={index}
            className={styles.term}
            onMouseEnter={() => setOpenTerm(part)}
            onMouseLeave={() => setOpenTerm(null)}
          >
            {part}
            {openTerm === part && (
              <span className={styles.card} role="tooltip">
                <span className={styles.cardTitle}>
                  <Icon src={termIcon} size={14} />
                  {GLOSSARY[part].name}
                </span>
                <span className={styles.cardText}>{GLOSSARY[part].meaning}</span>
                <span className={styles.cardFooter}>
                  <span>내 도우미에 저장됐어요</span>
                  {onAsk && (
                    <button type="button" className={styles.ask} onClick={() => onAsk(part)}>
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
