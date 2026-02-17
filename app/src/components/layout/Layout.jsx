import { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [sidebarOpen]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  const handleTrapFocus = useCallback((e) => {
    if (e.key !== "Tab" || !sidebarRef.current) return;
    const focusable = sidebarRef.current.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    document.addEventListener("keydown", handleTrapFocus);
    return () => document.removeEventListener("keydown", handleTrapFocus);
  }, [sidebarOpen, handleTrapFocus]);

  return (
    <div className="min-h-screen bg-surface-900 text-surface-200">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar ref={sidebarRef} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onMenuToggle={() => setSidebarOpen((o) => !o)} />

      <main className="lg:ml-[200px] pt-11 min-h-screen">
        <div className="p-4 sm:p-5">{children}</div>
      </main>
    </div>
  );
}
