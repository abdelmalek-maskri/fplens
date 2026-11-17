import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ROUTE_META, SITE_NAME, pageTitle } from "../../lib/routeMeta";

// Routes that deliberately have no entry. A dynamic id cannot be described at
// build time, and NotFound should not advertise itself.
const UNLISTED = new Set(["/player/:id", "*"]);

function routesInApp() {
  // Read as text rather than imported, because importing App.jsx would mount
  // the whole route tree to answer a question about a list of strings.
  const src = readFileSync(resolve("src/App.jsx"), "utf8");
  const paths = [...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
  // A regex that silently matches nothing would make both drift tests pass
  // for the wrong reason.
  expect(paths.length).toBeGreaterThan(5);
  return paths;
}

describe("routeMeta", () => {
  it("describes every route the app renders", () => {
    // A new route with no entry falls back to the generic title and the
    // generic link preview, which is the state this whole file exists to end.
    const missing = routesInApp().filter((p) => !UNLISTED.has(p) && !(p in ROUTE_META));
    expect(missing).toEqual([]);
  });

  it("describes no route the app does not render", () => {
    const real = new Set(routesInApp());
    const stale = Object.keys(ROUTE_META).filter((p) => !real.has(p));
    expect(stale).toEqual([]);
  });

  it("gives the root the bare site name, not a prefixed one", () => {
    expect(pageTitle("/")).toBe(SITE_NAME);
  });

  it("prefixes every other route with its own name", () => {
    expect(pageTitle("/accuracy")).toBe("Accuracy · FPLens");
    expect(pageTitle("/insights")).toBe("Model Insights · FPLens");
  });

  it("falls back to the site name for a route it does not know", () => {
    expect(pageTitle("/player/42")).toBe(SITE_NAME);
  });

  it("gives every entry a description long enough to be worth showing", () => {
    // A preview card truncates around 160 characters and looks empty under
    // about 50, so this catches a placeholder left behind.
    for (const [route, meta] of Object.entries(ROUTE_META)) {
      expect(meta.name, route).toBeTruthy();
      expect(meta.description.length, route).toBeGreaterThan(50);
    }
  });
});
