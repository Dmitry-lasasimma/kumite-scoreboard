import React from 'react';
import { OperatorNotification } from '../../types/score';

interface NotificationStackProps {
  notifications: OperatorNotification[];
  on_dismiss: (id: string) => void;
}

/**
 * Operator reminders, stacked down the right-hand side of the scoring screen.
 * A reminder stays until the operator resolves it (the Senshu state changes)
 * or closes it, and clears itself a few seconds after play resumes.
 */
export default function NotificationStack({ notifications, on_dismiss }: NotificationStackProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-24 right-5 z-50 flex flex-col gap-2.5 w-80 pointer-events-none">
      {notifications.map(n => {
        const is_blue = n.side === 'blue';
        return (
          <div
            key={n.id}
            role="status"
            className={`pointer-events-auto rounded-2xl bg-white shadow-2xl border border-gray-100
                        border-l-[6px] p-3.5 flex gap-3 items-start animate-slide-in
                        ${is_blue ? 'border-l-kumite-blue-500' : 'border-l-kumite-red-500'}`}
          >
            <div
              className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg
                          ${n.kind === 'senshu_award'
                            ? 'bg-yellow-100 text-yellow-600'
                            : 'bg-orange-100 text-orange-600'}`}
              aria-hidden
            >
              {n.kind === 'senshu_award' ? '🏳' : '⚠'}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-gray-900 leading-tight">{n.title}</div>
              <div className="text-xs text-gray-500 mt-1 leading-snug">{n.message}</div>
            </div>

            <button
              onClick={() => on_dismiss(n.id)}
              aria-label="Dismiss reminder"
              className="shrink-0 w-6 h-6 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100
                         transition-all flex items-center justify-center text-sm font-bold"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
