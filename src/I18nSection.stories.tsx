import type {Meta, StoryObj} from '@storybook/react-vite';
import i18next from 'i18next';
import I18nSection from './I18nSection';

const i18n = i18next.createInstance();
void i18n.init({
  lng: 'ko',
  fallbackLng: 'en',
  resources: {
    ko: {translation: {greeting: '안녕하세요', cta: '시작하기'}},
    en: {translation: {greeting: 'Hello', cta: 'Start'}},
  },
});

const meta: Meta<typeof I18nSection> = {
  title: 'Panel/I18nSection',
  component: I18nSection,
  decorators: [
    Story => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof I18nSection>;

export const Default: Story = {args: {i18n, languages: ['ko', 'en'], fallbackLng: 'en'}};

// 시트 연동 UI까지 켜진 버전(데모 값이라 실제 OAuth는 동작하지 않음).
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
};
