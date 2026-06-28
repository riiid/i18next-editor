import type {Preview} from '@storybook/react-vite';
import ShadowHost from '../src/lib/ShadowHost';

/**
 * 모든 스토리를 실제 런타임과 동일하게 Shadow DOM(ShadowHost) 안에서 렌더한다.
 * → 컴파일된 Tailwind CSS가 shadow root 에 주입되어 실제 패널과 똑같이 보인다.
 */
const preview: Preview = {
  parameters: {
    controls: {matchers: {color: /(background|color)$/i, date: /Date$/i}},
  },
  decorators: [
    Story => (
      <ShadowHost>
        <div className="flex flex-wrap items-start gap-2 bg-card p-4 text-card-foreground">
          <Story />
        </div>
      </ShadowHost>
    ),
  ],
};

export default preview;
