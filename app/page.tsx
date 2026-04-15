import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Landing page with entry to the AVE node agent canvas.
 */
export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          AVE Node Agent Platform
        </h1>
        <p className="mt-3 text-muted-foreground">
          Drag-and-drop Supervisor, subagents, and protected Trader/Wallet nodes.
          Hermes powers reasoning; AVE delegate APIs execute trades (optional).
        </p>
      </div>
      <Link
        href="/canvas"
        className={cn(buttonVariants({ size: "lg" }))}
      >
        Open canvas
      </Link>
    </div>
  );
}
