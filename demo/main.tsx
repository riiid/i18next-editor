import i18n from 'i18next';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nextProvider, initReactI18next, useTranslation} from 'react-i18next';
import {I18nEditor} from '@';

const resources = {
  ko: {
    translation: {
      title: 'i18next-editor 데모',
      subtitle: '화면의 번역 텍스트를 클릭해 바로 고쳐보세요.',
      greeting: '안녕하세요, {{name}}님!',
      cta: '시작하기',
      nested: {description: '중첩 키도 그대로 잡힙니다.'},
      // ja/en 에는 일부러 빠뜨려 "미번역 배지"를 보여준다.
      koOnly: '이 키는 한국어에만 있어요.',
    },
  },
  ja: {
    translation: {
      title: 'i18next-editor デモ',
      subtitle: '画面の翻訳テキストをクリックして直接編集できます。',
      greeting: 'こんにちは、{{name}}さん！',
      cta: 'はじめる',
      nested: {description: 'ネストされたキーもそのまま拾います。'},
    },
  },
  en: {
    translation: {
      title: 'i18next-editor demo',
      subtitle: 'Click any translated text on screen to edit it inline.',
      greeting: 'Hello, {{name}}!',
      cta: 'Get started',
      nested: {description: 'Nested keys are picked up too.'},
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
      <p className="hint">{t('subtitle')}</p>

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

      <div className="card">
        <h2>{t('greeting', {name: 'Sora'})}</h2>
        <p>{t('nested.description')}</p>
        <p>{t('koOnly')}</p>
        <button type="button" className="app">
          {t('cta')}
        </button>
      </div>

      <p className="hint" style={{marginTop: 32}}>
        <code>Ctrl/⌘ + Shift + D</code> 로 편집 패널을 토글하세요. 패널 안에서 picker 모드를 켜고 위
        텍스트를 클릭하면 그 키의 전 언어 값이 패널에 뜹니다. 값을 고치면 <code>localStorage</code>{' '}
        override 로 즉시 화면에 반영됩니다.
      </p>
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
