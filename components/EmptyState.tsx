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
    <div className="fade-in flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-muted)]">
          {icon}
        </div>
      )}
      <h3 className="mb-1 text-lg font-semibold text-[var(--foreground)]">
        {title}
      </h3>
      <p className="mb-4 max-w-sm text-sm text-[var(--muted-foreground)]">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="btn-press focus-ring rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--accent-hover)]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
