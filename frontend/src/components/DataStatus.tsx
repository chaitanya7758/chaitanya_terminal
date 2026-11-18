export type Status = "Live" | "Delayed" | "Previous Close" | "Estimated" | "Manual" | "Calculated" | "Unavailable";

const styles: Record<Status, string> = {
  Live: "bg-up/15 text-up",
  Delayed: "bg-warn/15 text-warn",
  "Previous Close": "bg-panel-2 text-muted",
  Estimated: "bg-warn/15 text-warn",
  Manual: "bg-accent/15 text-accent",
  Calculated: "bg-accent/15 text-accent",
  Unavailable: "bg-panel-2 text-muted",
};

export function DataStatus({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`}>
      {status === "Live" && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-up" />}
      {status}
    </span>
  );
}
