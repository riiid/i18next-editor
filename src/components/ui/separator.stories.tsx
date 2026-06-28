import type {Meta, StoryObj} from '@storybook/react-vite';
import {Separator} from './separator';

const meta: Meta<typeof Separator> = {
  title: 'UI/Separator',
  component: Separator,
  decorators: [
    Story => (
      <div className="w-56">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Separator>;

export const Default: Story = {};
