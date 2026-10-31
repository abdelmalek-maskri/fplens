import { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useGameweek } from "../../hooks/useGameweek";

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: gwData } = useGameweek();
  const sidebarRef = useRef(null);
  const menuButtonRef = useRef(null);
  const wasOpenRef = useRef(false);

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

  // Without this a reader who closes the drawer is dropped at the top of the
  // document, with no way back to the control they were just using.
  //
  // Focus goes to the menu button by name rather than to whatever was active
  // when the drawer opened: Safari does not focus a button when it is clicked,
  // so document.activeElement is often <body> there. The menu button is the
  // only thing that opens this, so it is always the right place to come back to.
  useEffect(() => {
    if (sidebarOpen) {
      wasOpenRef.current = true;
      sidebarRef.current?.querySelector("a[href], button:not([disabled])")?.focus();
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      menuButtonRef.current?.focus();
    }
  }, [sidebarOpen]);

  // Crossing into the desktop layout hides the backdrop and the close button,
  // both lg:hidden, but would leave aria-modal and the focus trap switched on
  // over a sidebar that is now simply part of the page. That walls a screen
  // reader off from content it can see.
  useEffect(() => {
    const mq = window.matchMedia?.("(min-width: 1024px)");
    if (!mq) return;
    const sync = (e) => {
      if (e.matches) setSidebarOpen(false);
    };
    sync(mq);
    // addListener is the pre-14 Safari spelling, which is the browser this
    // whole effect exists for.
    mq.addEventListener ? mq.addEventListener("change", sync) : mq.addListener(sync);
    return () =>
      mq.removeEventListener ? mq.removeEventListener("change", sync) : mq.removeListener(sync);
  }, []);

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
    <div className="min-h-screen bg-surface-100 text-surface-800">
      {sidebarOpen && (
        // A click-catcher, not a control. Escape and the drawer's own close
        // button already cover keyboard and screen reader, so announcing this
        // only duplicates their name and puts a viewport-sized button in the
        // tab order. tabIndex is required alongside aria-hidden, which may not
        // sit on anything focusable.
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        ref={sidebarRef}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        gwData={gwData}
      />
      <Header
        onMenuToggle={() => setSidebarOpen((o) => !o)}
        gwData={gwData}
        menuButtonRef={menuButtonRef}
      />

      <main className="lg:ml-[200px] pt-11 min-h-screen">
        <div className="p-4 sm:p-5">{children}</div>
      </main>
    </div>
  );
}
