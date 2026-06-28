import type {Meta, StoryObj} from '@storybook/react-vite';
import {Input} from './input';

const meta = {
  title: 'UI/Input',
  component: Input,
  decorators: [Story => <div className="w-56"><Story /></div>],
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {args: {placeholder: '입력하세요'}};
export const Disabled: Story = {args: {placeholder: '비활성', disabled: true}};
