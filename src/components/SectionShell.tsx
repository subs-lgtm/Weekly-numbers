"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";

export function SectionShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={title} description={description} actions={actions} />
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}

export function ComingSoon({ note }: { note?: string }) {
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed">
      <div className="text-center">
        <p className="text-sm font-medium">Section scaffolded</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {note ?? "Data integrations and entry forms land in the next iteration."}
        </p>
      </div>
    </div>
  );
}