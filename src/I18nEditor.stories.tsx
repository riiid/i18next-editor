import type {Meta, StoryObj} from '@storybook/react-vite';
import i18next from 'i18next';
import I18nEditor from './I18nEditor';

// 스토리용 mock i18next 인스턴스.
const i18n = i18next.createInstance();
void i18n.init({
  lng: 'ko',
  fallbackLng: 'en',
  resources: {
    ko: {translation: {greeting: '안녕하세요', cta: '시작하기'}},
    en: {translation: {greeting: 'Hello', cta: 'Start'}},
  },
});

const meta = {
  title: 'Panel/I18nEditor',
  component: I18nEditor,
  parameters: {layout: 'fullscreen'},
} satisfies Meta<typeof I18nEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

// 패널을 자동으로 여는 play 함수(Ctrl+Shift+D 디스패치).
const openPanel = async () => {
  window.dispatchEvent(new KeyboardEvent('keydown', {key: 'D', ctrlKey: true, shiftKey: true}));
};

export const Default: Story = {
  args: {i18n, languages: ['ko', 'en'], fallbackLng: 'en'},
  play: openPanel,
};

// 구글 시트 동기화 설정을 주입한 버전. 패널 하단에 시트 연동 UI가 켜진다.
// (clientId/spreadsheetId는 데모 값이라 실제 OAuth는 동작하지 않음)
export const WithSheets: Story = {
  args: {
    i18n,
    languages: ['ko', 'en'],
    fallbackLng: 'en',
    sheets: {
      clientId: 'demo.apps.googleusercontent.com',
      spreadsheetId: '1AbCdefGhIjkLmnOpQrStUvWxYz',
      tab: 'translations',
      langCol: {ko: 2, en: 4},
    },
  },
  play: openPanel,
};
