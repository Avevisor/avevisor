"use client";

import Link from "next/link";

import { FlowCanvas } from "@/components/node-canvas/flow-canvas";
import { Button } from "@/components/ui/button";

/**
 * Dashboard page: AVE node agent canvas.
 */
export default function CanvasPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Home
          </Link>
          <h1 className="text-sm font-semibold">AVE Node Agent</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("avevisor:reset-flow"));
            }
          }}
        >
          Reset canvas
        </Button>
      </header>
      <FlowCanvas />
    </div>
  );
}
