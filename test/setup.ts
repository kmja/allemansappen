import "@testing-library/jest-dom/vitest";

// jsdom lacks a few browser APIs that Radix UI / our components touch. Polyfill
// them for component tests. Guarded so node-environment tests are unaffected.
if (typeof window !== "undefined") {
  const win = window as unknown as {
    matchMedia?: typeof window.matchMedia;
    ResizeObserver?: typeof ResizeObserver;
  };

  if (!win.matchMedia) {
    win.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  if (!win.ResizeObserver) {
    win.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  const el = Element.prototype as unknown as Record<string, unknown>;
  el.hasPointerCapture ??= () => false;
  el.setPointerCapture ??= () => {};
  el.releasePointerCapture ??= () => {};
  el.scrollIntoView ??= () => {};
}
