import type { ReactNode } from 'react';

interface Props { label: string; hint?: string; error?: string; children: ReactNode }

export default function Field({ label, hint, error, children }: Props) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
      {error && <span className="error" role="alert">{error}</span>}
    </label>
  );
}
