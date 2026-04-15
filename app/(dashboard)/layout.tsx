/**
 * Dashboard layout: full-height shell for the node canvas.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-screen flex-col">{children}</div>;
}
