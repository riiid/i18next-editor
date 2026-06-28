import type {Meta, StoryObj} from '@storybook/react-vite';
import {Badge} from './badge';

const meta = {title: 'UI/Badge', component: Badge} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <>
      <Badge>default</Badge>
      <Badge variant="secondary">secondary</Badge>
      <Badge variant="outline">신규</Badge>
    </>
  ),
};
