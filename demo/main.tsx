import i18n from 'i18next';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nextProvider, initReactI18next, useTranslation} from 'react-i18next';
import {I18nEditor} from '@';

// 데모 본문 = i18next-editor 사용설명서. 각 문장이 번역키라서 picker로 하나씩 클릭해 확인할 수 있다.
// ja 는 일부러 일부 키를 비워 "미번역 배지"를 보여준다.
const resources = {
  ko: {
    translation: {
      title: 'i18next-editor 사용설명서',

      summary: {
        heading: '한 줄 요약',
        body: '우리 서비스 화면에 보이는 글자(번역 문구)를, 화면에서 직접 클릭해 고치고 바로 미리볼 수 있게 해주는 도구입니다.',
        warning:
          '⚠️ 여기서 고친 값은 내 화면 미리보기일 뿐입니다. 진짜로 서비스에 반영되려면 그 내용이 코드(번역 파일)에 들어가야 합니다.',
      },

      usage: {
        heading: '사용 방법',
        step1: '도구가 설치된 환경(보통 개발/테스트 화면)에서 서비스를 엽니다.',
        step2: 'Ctrl+Shift+D (mac ⌘+Shift+D) 로 편집 패널을 엽니다.',
        step3: '고치고 싶은 화면 속 글자를 클릭합니다.',
        step4: '패널에서 언어별 값(한/일/영...)을 수정하면 화면에 바로 반영됩니다.',
        step5: '구글 시트 기능이 켜져 있으면 수정값을 시트에 저장하거나 시트값을 불러옵니다.',
      },

      reflect: {
        heading: '고친 내용이 "진짜로" 반영되기까지',
        step1: '화면에서 클릭해 수정 → 내 화면에 즉시 미리보기 (나만 보임)',
        step2: '구글 시트에 저장(선택) → 팀이 번역을 시트로 관리할 때의 전달 통로',
        step3: '개발자가 코드(번역 파일)에 반영 + 배포 → 모든 사용자에게 진짜 반영',
      },

      concepts: {
        heading: '핵심 개념 3가지',
        picker: {
          title: '번역키 picker',
          body: '화면의 번역 문구를 클릭하면 그 문구의 모든 언어 값이 한 패널에 모여 한꺼번에 수정됩니다.',
        },
        override: {
          title: 'override (덮어쓰기 미리보기)',
          body: '고친 값은 내 브라우저에만 임시 저장되어 즉시 화면에 반영됩니다. 패널의 "override된 번역키 일괄 확인" 버튼에서 표로 모아 보고, 줄마다 "되돌리기"로 원본 복구할 수 있습니다.',
        },
        sheets: {
          title: 'Google Sheets 동기화 (선택)',
          body: '고친 값을 회사 구글 시트에 올리거나 시트값을 가져옵니다. 설정을 넣어줬을 때만 켜집니다.',
        },
      },

      faq: {
        heading: '자주 묻는 질문',
        q1: '내가 고치면 실제 서비스 글자가 바뀌나요?',
        a1: '아니요. 내 브라우저에서만 보이는 미리보기입니다. 실제 반영은 코드에 들어가야 합니다.',
        q2: '잘못 고쳤어요. 원래 값으로 어떻게 되돌리나요?',
        a2: '패널의 "override된 번역키 일괄 확인" 모달에서 각 줄의 "되돌리기" 버튼을 누르면 그 키만 원본으로 복구됩니다.',
        q3: '어떤 화면에서 쓸 수 있나요?',
        a3: '이 도구가 설치된 우리 서비스라면 어디서든. 특정 페이지에 묶여있지 않습니다.',
      },
    },
  },
  ja: {
    translation: {
      title: 'i18next-editor 利用ガイド',
      summary: {
        heading: '一行まとめ',
        body: 'サービス画面に表示される文言を、画面上で直接クリックして編集し、すぐにプレビューできるツールです。',
      },
      usage: {
        heading: '使い方',
      },
      concepts: {
        heading: '主要コンセプト3つ',
      },
      faq: {
        heading: 'よくある質問',
      },
      // 残りのキーはわざと未翻訳（バッジ表示デモ）。
    },
  },
  en: {
    translation: {
      title: 'i18next-editor User Guide',

      summary: {
        heading: 'In one line',
        body: 'A tool that lets you click any translated text on screen, edit it, and preview the change instantly.',
        warning:
          '⚠️ Edits here are only a local preview. To truly ship them, the values must land in the code (translation files).',
      },

      usage: {
        heading: 'How to use',
        step1: 'Open the service in an environment where the tool is installed (usually dev/test).',
        step2: 'Press Ctrl+Shift+D (mac ⌘+Shift+D) to open the editor panel.',
        step3: 'Click the on-screen text you want to edit.',
        step4: 'Edit the per-language values in the panel; the screen updates instantly.',
        step5: 'If Google Sheets sync is on, push edits to the sheet or pull values from it.',
      },

      reflect: {
        heading: 'How an edit actually ships',
        step1: 'Click & edit on screen → instant local preview (only you see it)',
        step2: 'Save to Google Sheets (optional) → hand-off path when the team manages translations in a sheet',
        step3: 'A developer commits it to the code (translation files) + deploys → shipped to all users',
      },

      concepts: {
        heading: 'Three core concepts',
        picker: {
          title: 'Translation-key picker',
          body: 'Click a translated phrase and all of its language values gather in one panel to edit together.',
        },
        override: {
          title: 'override (preview)',
          body: 'Edits are stored only in your browser and applied instantly. The "review all overrides" button shows them in a table where each row has a "revert" to restore the original.',
        },
        sheets: {
          title: 'Google Sheets sync (optional)',
          body: 'Push edits to a company Google Sheet or pull values from it. Only enabled when configured.',
        },
      },

      faq: {
        heading: 'FAQ',
        q1: 'Does editing change the real service text?',
        a1: 'No. It is a preview visible only in your browser. Real changes must land in the code.',
        q2: 'I made a mistake — how do I restore the original?',
        a2: 'In the "review all overrides" modal, click the "revert" button on a row to restore that key to its original.',
        q3: 'Where can I use it?',
        a3: 'On any of our services where the tool is installed. It is not tied to a specific page.',
      },
    },
  },
};

const languages = ['ko', 'ja', 'en'];

// 둘 다 env로 주면 구글 시트 동기화 UI가 켜진다. 없으면 picker+override만 동작.
// 시트 레이아웃(tab/keyCol/langCol)은 README 기본 레이아웃(A:key B:memo C:ko D:ja E:en).
const {VITE_SHEETS_CLIENT_ID: clientId, VITE_SHEETS_SPREADSHEET_ID: spreadsheetId} = import.meta.env;
const sheets =
  clientId && spreadsheetId
    ? {clientId, spreadsheetId, tab: 'Sheet1', keyCol: 0, langCol: {ko: 2, ja: 3, en: 4}}
    : undefined;

i18n.use(initReactI18next).init({
  resources,
  lng: 'ko',
  fallbackLng: 'en',
  interpolation: {escapeValue: false},
});

function App() {
  const {t, i18n} = useTranslation();
  return (
    <main>
      <h1>{t('title')}</h1>

      <div className="row">
        <label htmlFor="lng">lang</label>
        <select id="lng" value={i18n.language} onChange={e => i18n.changeLanguage(e.target.value)}>
          {languages.map(l => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <p className="hint">
        <code>Ctrl/⌘ + Shift + D</code> 로 편집 패널을 토글하세요. picker 모드를 켜고 아래 텍스트를
        클릭하면 그 키의 전 언어 값이 패널에 뜹니다.
      </p>

      <div className="card">
        <h2>{t('summary.heading')}</h2>
        <p>{t('summary.body')}</p>
        <p className="hint">{t('summary.warning')}</p>
      </div>

      <div className="card">
        <h2>{t('usage.heading')}</h2>
        <ol>
          <li>{t('usage.step1')}</li>
          <li>{t('usage.step2')}</li>
          <li>{t('usage.step3')}</li>
          <li>{t('usage.step4')}</li>
          <li>{t('usage.step5')}</li>
        </ol>
      </div>

      <div className="card">
        <h2>{t('reflect.heading')}</h2>
        <ol>
          <li>{t('reflect.step1')}</li>
          <li>{t('reflect.step2')}</li>
          <li>{t('reflect.step3')}</li>
        </ol>
      </div>

      <div className="card">
        <h2>{t('concepts.heading')}</h2>
        <h3>{t('concepts.picker.title')}</h3>
        <p>{t('concepts.picker.body')}</p>
        <h3>{t('concepts.override.title')}</h3>
        <p>{t('concepts.override.body')}</p>
        <h3>{t('concepts.sheets.title')}</h3>
        <p>{t('concepts.sheets.body')}</p>
      </div>

      <div className="card">
        <h2>{t('faq.heading')}</h2>
        <p>
          <strong>{t('faq.q1')}</strong>
        </p>
        <p>{t('faq.a1')}</p>
        <p>
          <strong>{t('faq.q2')}</strong>
        </p>
        <p>{t('faq.a2')}</p>
        <p>
          <strong>{t('faq.q3')}</strong>
        </p>
        <p>{t('faq.a3')}</p>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
      <I18nEditor i18n={i18n} languages={languages} fallbackLng="en" sheets={sheets} />
    </I18nextProvider>
  </StrictMode>,
);
