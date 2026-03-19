import type { ReactNode } from "react";

interface EmptyStateProps {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly action?: {
    readonly label: string;
    readonly onClick: () => void;
  };
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--muted)]">
          {icon}
        </div>
      )}
      <h3 className="mb-1 text-base font-semibold text-[var(--foreground)]">
        {title}
      </h3>
      <p className="mb-4 max-w-xs text-sm text-[var(--muted-foreground)]">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
