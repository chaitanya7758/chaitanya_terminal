export function Panel({ title, right, children, className = "" }: { title?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-panel ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
          {right}
        </div>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

export function NotYetBuilt({ stage, what }: { stage: string; what: string }) {
  return (
    <Panel title="Not built yet">
      <p className="text-sm">{what}</p>
      <p className="mt-2 text-xs text-muted">Planned for {stage}. No placeholder or sample data is shown here.</p>
    </Panel>
  );
}
