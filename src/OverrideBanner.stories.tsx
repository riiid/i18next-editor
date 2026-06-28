import type {Meta, StoryObj} from '@storybook/react-vite';
import i18next from 'i18next';
import OverrideBanner from './OverrideBanner';
import {initOverrideBase, saveOverrides} from './overrides';

const i18n = i18next.createInstance();
void i18n.init({
  lng: 'ko',
  fallbackLng: 'en',
  resources: {
    ko: {translation: {greeting: '안녕하세요'}},
    en: {translation: {greeting: 'Hello'}},
  },
});

// 배너는 override가 하나라도 있을 때만 보인다 → base 스냅샷 + override를 미리 심어둔다.
initOverrideBase(i18n, ['ko', 'en']);
saveOverrides({ko: {greeting: '수정된 인사말'}});

const meta = {
  title: 'Panel/OverrideBanner',
  component: OverrideBanner,
  parameters: {layout: 'fullscreen'},
} satisfies Meta<typeof OverrideBanner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {args: {i18n}};
