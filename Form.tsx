'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { ActionResult } from '@/lib/action';

const initial: ActionResult = { ok: false, message: '' };

function Submit({ label, className }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className ?? 'jud-btn-primary'} disabled={pending}>
      {pending ? '...' : label}
    </button>
  );
}

type Props = {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children?: ReactNode;
  submit?: string;
  submitClass?: string;
  confirm?: string;
  resetOnOk?: boolean;
  className?: string;
  inline?: boolean;
};

// עוטף Server Action: מציג הודעת הצלחה/שגיאה, מאפשר אישור לפני שליחה ואיפוס טופס
export default function Form({ action, children, submit, submitClass, confirm, resetOnOk, className, inline }: Props) {
  const [state, formAction] = useFormState(action, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={`${inline ? 'inline-form' : ''} ${className ?? ''}`}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {submit && <Submit label={submit} className={submitClass} />}
      {state.message && (
        <div className={`msg ${state.ok ? 'ok' : 'err'}`} role="status">
          {state.message}
        </div>
      )}
    </form>
  );
}
