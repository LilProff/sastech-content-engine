'use client';

import { type ButtonHTMLAttributes } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';

type Variant = 'primary' | 'ghost' | 'danger';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-accent-foreground',
  ghost: 'border border-border text-muted hover:border-border-hover hover:text-foreground',
  danger: 'text-danger hover:bg-danger/10',
};

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof HTMLMotionProps<'button'>> &
  HTMLMotionProps<'button'> & { variant?: Variant };

export function Button({ variant = 'ghost', className = '', disabled, ...props }: ButtonProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.97 }}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
