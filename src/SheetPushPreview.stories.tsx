import type {Meta, StoryObj} from '@storybook/react-vite';
import SheetPushPreview from './SheetPushPreview';

const meta = {
  title: 'Panel/SheetPushPreview',
  component: SheetPushPreview,
  parameters: {layout: 'fullscreen'},
} satisfies Meta<typeof SheetPushPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    languages: ['ko', 'en'],
    busy: false,
    onConfirm: () => {},
    onCancel: () => {},
    diffs: [
      {key: 'greeting', lang: 'ko', asIs: '안녕하세요', toBe: '반갑습니다', isNew: false},
      {key: 'cta', lang: 'en', asIs: '', toBe: 'Get started', isNew: true},
    ],
    // 변경 안 된 언어 칸에 회색으로 표시할 현재값.
    currentByKey: {
      greeting: {ko: '안녕하세요', en: 'Hello'},
      cta: {ko: '시작하기', en: ''},
    },
  },
};
