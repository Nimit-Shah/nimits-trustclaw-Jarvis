import { TooltipProvider } from "~/components/ui/tooltip";
import { Sidebar } from "./_components/sidebar";
import { MobileSidebar } from "./_components/mobile-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        {/* Mobile header + sheet sidebar */}
        <MobileSidebar />

        {/* Desktop: fixed sidebar + flex content */}
        <div className="hidden md:flex flex-1 min-h-0">
          {/* Left sidebar — fixed 280px */}
          <aside className="w-[280px] shrink-0 border-r border-border overflow-hidden">
            <Sidebar />
          </aside>

          {/* Center content — fills remaining space */}
          <div className="flex-1 min-w-0 flex flex-col">
            {children}
          </div>
        </div>

        {/* Mobile: full-width content */}
        <div className="flex md:hidden flex-1 min-h-0">
          {children}
        </div>
      </div>
    </TooltipProvider>
  );
}