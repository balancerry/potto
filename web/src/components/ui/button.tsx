import { cn } from '@/lib/utils';
import Link from 'next/link';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent/90 shadow-sm',
  secondary: 'bg-accent-soft text-accent hover:bg-accent-soft/80',
  ghost: 'bg-transparent text-ink hover:bg-surface-sunk',
  danger: 'bg-neg text-white hover:bg-neg/90',
  outline: 'border border-line bg-surface text-ink hover:bg-surface-sunk',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-[var(--radius-sm)]',
  md: 'h-11 px-4 text-sm rounded-[var(--radius-md)]',
  lg: 'h-12 px-5 text-base rounded-[var(--radius-md)]',
};

const base =
  'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 disabled:pointer-events-none';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', disabled, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export function ButtonLink({
  href,
  className,
  variant = 'primary',
  size = 'md',
  children,
}: {
  href: string;
  className?: string;
  variant?: Variant;
  size?: Size;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
