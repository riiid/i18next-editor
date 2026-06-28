import type {HTMLAttributes} from 'react';
import {cn} from '@/lib/utils';

/** 가로 구분선. native hr 기반(Radix 불필요). */
export function Separator({className, ...props}: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('h-px w-full border-0 bg-border', className)} {...props} />;
}
