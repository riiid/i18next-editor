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

// 번역키를 하나 고른 편집 상태. picker를 켠 뒤, data-i18n-key 가 박힌 호스트 요소를
// 클릭한 것처럼 시뮬레이션해 selectKey('greeting')를 트리거한다(production 코드 변경 없이).
export const WithPickedKey: Story = {
  args: {i18n, languages: ['ko', 'en'], fallbackLng: 'en'},
  play: async ({canvasElement}) => {
    const root = canvasElement.querySelector('div')?.shadowRoot;
    root?.querySelector('button')?.click(); // 첫 버튼 = 번역키 picker 켜기
    // picker on → useEffect가 document에 click 리스너를 붙일 시간을 준다.
    await new Promise(r => setTimeout(r, 60));
    const el = document.createElement('span');
    el.setAttribute('data-i18n-key', 'greeting');
    el.textContent = '안녕하세요';
    document.body.appendChild(el);
    el.click(); // capture 단계 document 리스너가 closest([data-i18n-key])로 키를 읽는다.
    el.remove();
  },
};

// 토스트 스택: 초기화 버튼을 연속으로 눌러 하단 중앙에 토스트가 쌓이는 모습.
export const WithToasts: Story = {
  args: {i18n, languages: ['ko', 'en'], fallbackLng: 'en'},
  play: async ({canvasElement}) => {
    const root = canvasElement.querySelector('div')?.shadowRoot;
    const reset = [...(root?.querySelectorAll('button') ?? [])].find(
      b => b.textContent?.includes('초기화')
    );
    reset?.click();
    await new Promise(r => setTimeout(r, 100));
    reset?.click();
  },
};

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
      keyCol: 0,
      langCol: {ko: 2, en: 4},
    },
  },
};
