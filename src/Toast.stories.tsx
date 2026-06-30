import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {type ToastItem, Toaster, useToasts} from './Toast';

const meta: Meta<typeof Toaster> = {
  title: 'Panel/Toast',
  component: Toaster,
};
export default meta;

// 스택: 토스트 여러 개가 하단 중앙에 쌓인 모습. 클릭하면 사라진다.
export const Stacked: StoryObj = {
  render: () => {
    const [toasts, setToasts] = useState<ToastItem[]>([
      {id: 1, msg: '저장됨: greeting'},
      {id: 2, msg: 'override 초기화됨'},
      {id: 3, msg: '반영 완료: 3건'},
    ]);
    return <Toaster toasts={toasts} dismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />;
  },
};

// 인터랙티브: 버튼으로 push, 토스트 클릭 시 dismiss, 2초 자동 사라짐까지 실제 훅으로 확인.
export const Interactive: StoryObj = {
  render: () => {
    const {toasts, push, dismiss} = useToasts();
    return (
      <div>
        <button type="button" onClick={() => push(`토스트 ${toasts.length + 1}`)}>
          토스트 추가
        </button>
        <Toaster toasts={toasts} dismiss={dismiss} />
      </div>
    );
  },
};
