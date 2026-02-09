import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-900 text-surface-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onMenuToggle={() => setSidebarOpen(o => !o)} />

      <main className="lg:ml-[220px] pt-14 min-h-screen">
        <div className="p-5 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
