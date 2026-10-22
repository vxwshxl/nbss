/**
 * "Hello, / Name" at the head of a dashboard, as birdev's console greets everyone. The
 * action (a button or two) sits to the right on wide screens and below on a phone.
 */
export function Greeting({ name, sub, action }: { name: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-lg text-muted-foreground">Hello,</p>
        <h1 className="display-section text-[clamp(2rem,4vw,3rem)] break-words">{name}</h1>
        {sub && <p className="mt-2 max-w-xl text-muted-foreground">{sub}</p>}
      </div>
      {action && <div className="action-row">{action}</div>}
    </div>
  );
}
