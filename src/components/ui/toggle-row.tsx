import type {LucideIcon} from 'lucide-react';
import {cn} from '@/lib/utils';

/** 라벨 + 우측 on/off 스위치로 된 토글 행. CTA 버튼이 아니라 모드 스위치로 읽히게 한다. */
export function ToggleRow({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs transition-colors cursor-pointer',
        checked
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}>
      <span className="flex items-center gap-1.5 font-medium">
        <Icon size={14} className={checked ? 'text-primary' : undefined} />
        {label}
      </span>
      <span
        className={cn(
          'relative h-4 w-7 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-input'
        )}>
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-3'
          )}
        />
      </span>
    </button>
  );
}
