/**
 * 11.S-retro — RTL voor A4Preview dynamische scaling + multi-page builder-preview.
 *
 * 5 cases (instructie §5):
 *  1. Scaling — verschillende viewport-widths → scale-attribuut verandert
 *  2. Multi-page — content die >1 A4 vereist → ≥2 A4Page-frames
 *  3. Page-counter — multi-page → "Pagina 1 / 2" label per pagina
 *  4. Single-page — geen counter zichtbaar (totalPages=1 → hidden)
 *  5. Print-CSS — page-counter krijgt `.strategie-onepager-source-tag`-class (PrintStyles.css verbergt deze)
 *
 * Optie A-pattern: echte AppConfigProvider + mock-supabase.rpc (consistent).
 * ResizeObserver is mocked omdat jsdom geen native impl heeft.
 */

import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../../../../shared/services/supabase.client", () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));

// ResizeObserver-mock voor jsdom (geen native impl). Houdt callbacks bij in
// een module-level array zodat tests kunnen trigger-een resize-event.
const resizeCallbacks = [];
class ResizeObserverMock {
  constructor(callback) {
    this.callback = callback;
    resizeCallbacks.push(this);
  }
  observe(el) {
    this.el = el;
  }
  unobserve() {}
  disconnect() {
    const i = resizeCallbacks.indexOf(this);
    if (i !== -1) resizeCallbacks.splice(i, 1);
  }
}
global.ResizeObserver = ResizeObserverMock;

function triggerResize(width, target) {
  // Trigger callbacks die `target` observeren (of alle als geen target).
  resizeCallbacks.forEach(ro => {
    if (!target || ro.el === target) {
      ro.callback([{ contentRect: { width, height: 842 } }]);
    }
  });
}

import { supabase } from "../../../../shared/services/supabase.client";
import { AppConfigProvider } from "../../../../shared/context/AppConfigContext";
import A4Preview, { A4Page } from "../A4Preview";

const rpcMock = supabase.rpc;

beforeEach(() => {
  jest.clearAllMocks();
  resizeCallbacks.length = 0;
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  rpcMock.mockResolvedValue({ data: [], error: null });
});

const baseProps = {
  vasteBlokken: [],
  selectedModels: [],
  withAi: false,
  insights: [],
  data: {},
  appLabel: (k, fb) => fb,
};

async function renderPreview(layoutComponent = null, overrides = {}) {
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <A4Preview
          {...baseProps}
          {...overrides}
          LayoutComponent={layoutComponent}
        />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return result;
}

// LayoutComponent dat 1 of 2 A4Page-children rendert op basis van prop.
function MultiPageLayout({ Page, totalPages = 1, appLabel }) {
  return (
    <>
      {Array.from({ length: totalPages }).map((_, i) => (
        <Page
          key={i}
          pageNum={i + 1}
          totalPages={totalPages}
          appLabel={appLabel}
        >
          <div data-testid={`content-page-${i + 1}`}>Page {i + 1} content</div>
        </Page>
      ))}
    </>
  );
}

describe("A4Preview — 11.S-retro scaling + multi-page builder-preview", () => {
  test("1. Scaling — verschillende viewport-widths → scale-attribuut verandert", async () => {
    await renderPreview(() => (
      <A4Page pageNum={1} totalPages={1} appLabel={(k, fb) => fb}>
        <div>content</div>
      </A4Page>
    ));

    const viewport = screen.getByTestId("a4-preview-viewport");
    // Initial scale = INITIAL_SCALE (0.65), maar ResizeObserver triggert na mount.
    // Trigger met viewport-width 800 → scale = (800-48)/1190 ≈ 0.632
    await act(async () => { triggerResize(800, viewport); });
    await waitFor(() => {
      const scale = parseFloat(viewport.getAttribute("data-scale"));
      expect(scale).toBeGreaterThan(0.4);
      expect(scale).toBeLessThan(0.7);
    });

    // Trigger met grotere width 1500 → scale ≥ 1.0 (clamped)
    await act(async () => { triggerResize(1500, viewport); });
    await waitFor(() => {
      expect(parseFloat(viewport.getAttribute("data-scale"))).toBe(1.0);
    });

    // Trigger met zeer kleine width 300 → scale clamp op MIN_SCALE (0.4)
    await act(async () => { triggerResize(300, viewport); });
    await waitFor(() => {
      expect(parseFloat(viewport.getAttribute("data-scale"))).toBe(0.4);
    });
  });

  test("2. Multi-page — LayoutComponent rendert 2 A4Page-frames", async () => {
    await renderPreview((props) => (
      <MultiPageLayout {...props} totalPages={2} />
    ));

    expect(screen.getByTestId("a4-page-1")).toBeInTheDocument();
    expect(screen.getByTestId("a4-page-2")).toBeInTheDocument();
    // A4Page heeft data-page-num + data-total-pages-attribuut
    expect(screen.getByTestId("a4-page-1")).toHaveAttribute("data-page-num", "1");
    expect(screen.getByTestId("a4-page-1")).toHaveAttribute("data-total-pages", "2");
    expect(screen.getByTestId("a4-page-2")).toHaveAttribute("data-page-num", "2");
  });

  test("3. Page-counter — multi-page → 'Pagina 1 / 2' label per pagina", async () => {
    await renderPreview((props) => (
      <MultiPageLayout {...props} totalPages={2} />
    ));

    const counter1 = screen.getByTestId("a4-page-counter-1");
    const counter2 = screen.getByTestId("a4-page-counter-2");
    expect(counter1).toHaveTextContent("Pagina 1 / 2");
    expect(counter2).toHaveTextContent("Pagina 2 / 2");
  });

  test("4. Single-page — geen counter zichtbaar (totalPages=1 → hidden)", async () => {
    await renderPreview((props) => (
      <MultiPageLayout {...props} totalPages={1} />
    ));

    expect(screen.getByTestId("a4-page-1")).toBeInTheDocument();
    // Counter is NIET in DOM bij totalPages=1
    expect(screen.queryByTestId("a4-page-counter-1")).not.toBeInTheDocument();
  });

  test("5. Print-CSS — page-counter krijgt .strategie-onepager-source-tag-class (PrintStyles.css verbergt)", async () => {
    await renderPreview((props) => (
      <MultiPageLayout {...props} totalPages={2} />
    ));

    const counter = screen.getByTestId("a4-page-counter-1");
    // PrintStyles.css regel: ".strategie-onepager-source-tag { display: none !important; }" in @media print.
    expect(counter.className).toMatch(/strategie-onepager-source-tag/);
  });
});
