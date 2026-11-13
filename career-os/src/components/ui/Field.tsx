import { type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

type FieldWrapperProps = {
  label: string;
  className?: string;
};

export function TextField({
  label,
  className = '',
  ...props
}: FieldWrapperProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
      />
    </label>
  );
}

export function TextAreaField({
  label,
  className = '',
  ...props
}: FieldWrapperProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <textarea
        {...props}
        className="w-full resize-y rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
      />
    </label>
  );
}
