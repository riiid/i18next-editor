import {type ButtonHTMLAttributes, forwardRef} from 'react';
import {cva, type VariantProps} from 'class-variance-authority';
import {cn} from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'border border-destructive/40 text-destructive bg-background hover:bg-destructive/10',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-7 px-3 py-1',
        sm: 'h-6 rounded px-2',
        lg: 'h-8 px-4',
        icon: 'h-7 w-7',
      },
    },
    defaultVariants: {variant: 'default', size: 'default'},
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({className, variant, size, type, ...props}, ref) => (
  <button ref={ref} type={type ?? 'button'} className={cn(buttonVariants({variant, size, className}))} {...props} />
));
Button.displayName = 'Button';
