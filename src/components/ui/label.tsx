import {type LabelHTMLAttributes, forwardRef} from 'react';
import {cn} from '@/lib/utils';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({className, ...props}, ref) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: 재사용 Label 프리미티브 — control은 호출부에서 연결한다.
    <label ref={ref} className={cn('text-xs font-medium leading-none text-muted-foreground', className)} {...props} />
  )
);
Label.displayName = 'Label';
