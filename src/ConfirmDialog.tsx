/**
 * 자체 confirm 모달. window.confirm 대신 쓴다(Shadow DOM 격리·패널 톤 유지).
 *
 * useConfirm(): {confirm, dialog}.
 * - confirm(message): 모달을 띄우고 사용자가 확인/취소를 누를 때까지 Promise<boolean>를 반환.
 *   호출부는 `if (!(await confirm('...'))) return;` 형태로 window.confirm과 동일하게 쓴다.
 * - dialog: 컴포넌트가 렌더 트리에 그려줘야 모달이 보인다(없으면 null).
 */
import {useCallback, useState} from 'react';
import {Check, TriangleAlert, X} from 'lucide-react';
import {Button} from './components/ui/button';

type Pending = {message: string; destructive: boolean; resolve: (ok: boolean) => void};

export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback(
    (message: string, opts?: {destructive?: boolean}) =>
      new Promise<boolean>(resolve => setPending({message, destructive: opts?.destructive ?? false, resolve})),
    []
  );
  const settle = (ok: boolean) => {
    if (pending) pending.resolve(ok);
    setPending(null);
  };
  const dialog = pending ? (
    <ConfirmDialog
      message={pending.message}
      destructive={pending.destructive}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;
  return {confirm, dialog};
}

type Props = {
  message: string;
  destructive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({message, destructive, onConfirm, onCancel}: Props) {
  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/45 p-6">
      <div className="flex w-[min(380px,92vw)] flex-col overflow-hidden rounded-lg bg-card text-card-foreground shadow-2xl">
        <div className="flex items-start gap-2 px-4 py-4 text-sm leading-relaxed">
          {destructive && <TriangleAlert size={16} className="mt-0.5 shrink-0 text-destructive" />}
          <span className="whitespace-pre-line break-words">{message}</span>
        </div>
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
            <Check size={14} />
            확인
          </Button>
          <Button variant="outline" onClick={onCancel}>
            <X size={14} />
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}
