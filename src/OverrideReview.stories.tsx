import type {Meta, StoryObj} from '@storybook/react-vite';
import OverrideReview from './OverrideReview';

const meta = {
  title: 'Panel/OverrideReview',
  component: OverrideReview,
  parameters: {layout: 'fullscreen'},
} satisfies Meta<typeof OverrideReview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    languages: ['ko', 'en'],
    onRevertKey: () => {},
    onClose: () => {},
    diffs: [
      {key: 'greeting', lang: 'ko', asIs: '안녕하세요', toBe: '반갑습니다', isNew: false},
      {key: 'greeting', lang: 'en', asIs: 'Hello', toBe: 'Hi there', isNew: false},
      {key: 'cta', lang: 'ko', asIs: '', toBe: '지금 시작', isNew: true},
    ],
    currentByKey: {
      greeting: {ko: '안녕하세요', en: 'Hello'},
      cta: {ko: '', en: 'Get started'},
    },
  },
};

export const Empty: Story = {
  args: {
    languages: ['ko', 'en'],
    onRevertKey: () => {},
    onClose: () => {},
    diffs: [],
    currentByKey: {},
  },
};
