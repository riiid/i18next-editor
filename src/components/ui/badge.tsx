import type {HTMLAttributes} from 'react';
import {cva, type VariantProps} from 'class-variance-authority';
import {cn} from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium leading-4', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      outline: 'border-primary text-primary',
    },
  },
  defaultVariants: {variant: 'default'},
});

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({className, variant, ...props}: BadgeProps) {
  return <span className={cn(badgeVariants({variant}), className)} {...props} />;
}
