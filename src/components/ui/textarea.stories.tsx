import type {Meta, StoryObj} from '@storybook/react-vite';
import {Textarea} from './textarea';

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  decorators: [Story => <div className="w-56"><Story /></div>],
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {args: {placeholder: '번역값을 입력하세요', rows: 3}};
