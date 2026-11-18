import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import type { SnackbarItem } from '../../domain/types';

interface SnackbarHostProps {
  items: SnackbarItem[];
  onDismiss: (id: string) => void;
}

export const SnackbarHost: React.FC<SnackbarHostProps> = ({ items, onDismiss }) => {
  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-[calc(100vw-2.5rem)] sm:w-auto pointer-events-none"
    >
      {items.map((item) => {
        const icon =
          item.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : item.tone === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          ) : item.tone === 'error' ? (
            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
          ) : (
            <Info className="w-4 h-4 shrink-0" style={{ color: 'var(--m3-primary)' }} />
          );

        return (
          <div
            key={item.id}
            role="status"
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border text-sm transition-all duration-200 m3-ease"
            style={{
              backgroundColor: 'var(--m3-surface-container-low)',
              borderColor: 'var(--m3-outline)',
              color: 'var(--m3-on-surface)',
            }}
          >
            {icon}
            <span className="flex-1 font-medium leading-snug">{item.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label="Dismiss notification"
              className="p-1.5 rounded-lg hover:opacity-80 transition-opacity min-h-[36px] min-w-[36px] flex items-center justify-center"
              style={{ color: 'var(--m3-on-surface-variant)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
