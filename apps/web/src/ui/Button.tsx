import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'outline';

const styles: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:brightness-105 font-semibold',
  ghost: 'text-foreground hover:bg-muted',
  outline: 'border border-border text-foreground hover:bg-muted',
};

export const Button = ({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) => (
  <button
    type="button"
    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm transition-colors disabled:opacity-50 ${styles[variant]} ${className}`}
    {...props}
  />
);

export const IconButton = ({ label, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={`inline-flex size-10 items-center justify-center rounded-lg text-foreground hover:bg-muted disabled:opacity-40 ${className}`}
    {...props}
  />
);
