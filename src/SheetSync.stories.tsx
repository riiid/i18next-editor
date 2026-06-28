import type {Meta, StoryObj} from '@storybook/react-vite';
import i18next from 'i18next';
import SheetSync from './SheetSync';

const i18n = i18next.createInstance();
void i18n.init({
  lng: 'ko',
  fallbackLng: 'en',
  resources: {
    ko: {translation: {greeting: '안녕하세요'}},
    en: {translation: {greeting: 'Hello'}},
  },
});

const meta: Meta<typeof SheetSync> = {
  title: 'Panel/SheetSync',
  component: SheetSync,
  decorators: [
    Story => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof SheetSync>;

// 버튼은 실제 구글 OAuth를 호출한다(데모 값이라 동작하지 않음). 정적 UI 확인용.
export const Default: Story = {
  args: {
    i18n,
    languages: ['ko', 'en'],
    sheets: {
      clientId: 'demo.apps.googleusercontent.com',
      spreadsheetId: '1AbCdefGhIjkLmnOpQrStUvWxYz',
      tab: 'translations',
      keyCol: 0,
      langCol: {ko: 2, en: 4},
    },
    overrides: {ko: {greeting: '수정된 인사말'}},
    setOverrides: () => {},
  },
};
