import { useState } from 'react';
import { getThemePreference, setThemePreference, type ThemePreference } from '../../utils/theme';
import layout from './SettingsLayout.module.css';
import SettingsLayout from './SettingsLayout';
import styles from './DisplaySettingsPage.module.css';

const OPTIONS: { value: ThemePreference; label: string; halves: ('light' | 'dark')[] }[] = [
  { value: 'light', label: '라이트', halves: ['light'] },
  { value: 'dark', label: '다크', halves: ['dark'] },
  { value: 'system', label: '시스템 설정 따르기', halves: ['light', 'dark'] },
];

/** 미리보기 속 작은 화면 (디자인 ThemeOption Preview) */
function Preview({ halves }: { halves: ('light' | 'dark')[] }) {
  return (
    <span className={styles.preview} aria-hidden="true">
      {halves.map((half) => (
        <span key={half} data-theme={half} className={styles.half}>
          <span className={styles.previewBar} />
          <span className={styles.previewCard}>
            <span className={`${styles.line} ${styles.lineText}`} />
            <span className={`${styles.line} ${styles.lineMuted}`} />
            <span className={`${styles.line} ${styles.linePrimary}`} />
          </span>
        </span>
      ))}
    </span>
  );
}

/** REQ-145, 154 화면 설정: 라이트, 다크, 시스템 설정 따르기 (디자인 SettingsPage 화면 설정) */
export default function DisplaySettingsPage() {
  const [theme, setTheme] = useState(getThemePreference);

  const choose = (value: ThemePreference) => {
    setTheme(value);
    setThemePreference(value);
  };

  return (
    <SettingsLayout title="화면 설정" description="테마를 내게 맞게 바꿔요">
      <fieldset className={layout.card}>
        <legend className={`${layout.cardTitle} ${styles.legend}`}>테마</legend>
        <div className={styles.options}>
          {OPTIONS.map((option) => (
            <label
              key={option.value}
              className={[styles.option, theme === option.value ? styles.selected : ''].filter(Boolean).join(' ')}
            >
              <Preview halves={option.halves} />
              <span className={styles.labelRow}>
                <input
                  type="radio"
                  name="theme"
                  className={styles.radio}
                  checked={theme === option.value}
                  onChange={() => choose(option.value)}
                />
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </SettingsLayout>
  );
}
