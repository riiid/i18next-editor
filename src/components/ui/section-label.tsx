import type {ReactNode} from 'react';
import type {LucideIcon} from 'lucide-react';

/** 섹션 머리말: 아이콘 + 섹션명. */
export function SectionLabel({icon: Icon, children}: {icon: LucideIcon; children: ReactNode}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
      <Icon size={13} />
      {children}
    </div>
  );
}
