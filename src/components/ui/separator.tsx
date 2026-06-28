import {type HTMLAttributes} from 'react';
import {cn} from '@/lib/utils';

/** 가로 구분선. native div 기반(Radix 불필요). */
export function Separator({className, ...props}: HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" className={cn('h-px w-full bg-border', className)} {...props} />;
}
