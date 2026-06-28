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

export const Default: Story = {
  args: {i18n, languages: ['ko', 'en'], fallbackLng: 'en'},
  // 마운트 후 Ctrl+Shift+D 를 디스패치해 패널을 자동으로 연다.
  play: async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'D', ctrlKey: true, shiftKey: true}));
  },
};
