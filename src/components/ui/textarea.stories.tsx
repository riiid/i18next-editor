import type {Meta, StoryObj} from '@storybook/react-vite';
import {Textarea} from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'UI/Textarea',
  component: Textarea,
  decorators: [Story => <div className="w-56"><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {args: {placeholder: '번역값을 입력하세요', rows: 3}};
