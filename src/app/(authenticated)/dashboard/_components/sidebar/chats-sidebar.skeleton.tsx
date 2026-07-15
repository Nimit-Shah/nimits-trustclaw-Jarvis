import { Skeleton } from "~/components/ui/skeleton";
import { MessageSquare } from "lucide-react";

export function ChatsSidebarSkeleton() {
  return (
    <div className="flex h-full flex-col border-r border-border">
      <div className="flex items-center gap-2 p-3">
        <Skeleton className="h-8 flex-1" />
      </div>
      <div className="px-3 pb-2">
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="min-h-0 flex-1 space-y-1 px-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 py-2">
            <MessageSquare className="size-4 shrink-0 text-muted-foreground/20" />
            <div className="min-w-0 flex-1">
              <Skeleton className="mb-1 h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}