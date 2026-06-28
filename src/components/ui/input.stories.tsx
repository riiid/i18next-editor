import type {Meta, StoryObj} from '@storybook/react-vite';
import {Input} from './input';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  decorators: [Story => <div className="w-56"><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {args: {placeholder: '입력하세요'}};
export const Disabled: Story = {args: {placeholder: '비활성', disabled: true}};
