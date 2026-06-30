/**
 * 하단 중앙에 스택으로 쌓이는 토스트.
 *
 * - useToasts(): {push, ...} 훅. push(msg)로 토스트를 띄우면 2초 뒤 자동 사라진다.
 * - Toaster: toasts/dismiss를 받아 그리는 presentational 컴포넌트. 클릭하면 즉시 닫힌다.
 */
import {useCallback, useRef, useState} from 'react';

export type ToastItem = {id: number; msg: string};

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  const push = useCallback(
    (msg: string) => {
      const id = ++idRef.current;
      setToasts(prev => [...prev, {id, msg}]);
      window.setTimeout(() => dismiss(id), 2000);
    },
    [dismiss]
  );
  return {toasts, push, dismiss};
}

export function Toaster({toasts, dismiss}: {toasts: ToastItem[]; dismiss: (id: number) => void}) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[2147483647] flex -translate-x-1/2 flex-col items-center gap-1.5">
      {toasts.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className="pointer-events-auto cursor-pointer whitespace-nowrap rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-lg">
          {t.msg}
        </button>
      ))}
    </div>
  );
}
