import type {Meta, StoryObj} from '@storybook/react-vite';
import {Button} from './button';

const meta = {title: 'UI/Button', component: Button} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {args: {children: '버튼'}};

export const Variants: Story = {
  render: () => (
    <>
      <Button>default</Button>
      <Button variant="secondary">secondary</Button>
      <Button variant="outline">outline</Button>
      <Button variant="ghost">ghost</Button>
      <Button variant="destructive">destructive</Button>
    </>
  ),
};

export const Sizes: Story = {
  render: () => (
    <>
      <Button size="sm">sm</Button>
      <Button size="default">default</Button>
      <Button size="lg">lg</Button>
    </>
  ),
};

export const Disabled: Story = {args: {children: '비활성', disabled: true}};
