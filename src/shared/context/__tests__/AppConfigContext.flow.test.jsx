/**
 * F30 Fix-pad B — AppConfigProvider auth-state-change listener.
 *
 * Race-condition tussen React-mount en Supabase-auth-restore: bij eerste
 * mount-fetch is auth-cookie soms nog niet beschikbaar → RPC-call in
 * anon-context → 0 rijen via RLS-block. Fix-pad B luistert op
 * `supabase.auth.onAuthStateChange` en re-fetcht bij `SIGNED_IN` of
 * `TOKEN_REFRESHED`.
 *
 * 3 cases:
 *   A. Mount met null-session → config blijft leeg, geen onAuthStateChange-error
 *   B. Mount + SIGNED_IN-event → loadConfig 2x aangeroepen
 *   C. Unmount → listener.unsubscribe wordt aangeroepen
 */

import React from "react";
import { render, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("../../services/supabase.client", () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      onAuthStateChange: jest.fn(),
    },
  },
}));

import { supabase } from "../../services/supabase.client";
import { AppConfigProvider, useAppConfig } from "../AppConfigContext";

const rpcMock = supabase.rpc;
const authChangeMock = supabase.auth.onAuthStateChange;
const unsubscribeMock = jest.fn();

function TestConsumer() {
  const { label, loading } = useAppConfig();
  return (
    <div>
      <span data-testid="fase4-titel">{label("klanten.fase.4.titel", "FALLBACK")}</span>
      <span data-testid="loading">{loading ? "true" : "false"}</span>
    </div>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: authStateChange retourneert subscription-object
  authChangeMock.mockImplementation(() => ({
    data: { subscription: { unsubscribe: unsubscribeMock } },
  }));
});

describe("AppConfigContext — F30 Fix-pad B auth-state-change listener", () => {
  test("A. mount met null-session → config blijft leeg + listener registered, geen error", async () => {
    // RPC retourneert 0 rijen (anon-RLS-block-simulatie)
    rpcMock.mockResolvedValue({ data: [], error: null });

    let result;
    await act(async () => {
      result = render(<AppConfigProvider><TestConsumer /></AppConfigProvider>);
    });

    // Loading klaar, fallback zichtbaar (config leeg)
    await waitFor(() => {
      expect(result.getByTestId("loading")).toHaveTextContent("false");
    });
    expect(result.getByTestId("fase4-titel")).toHaveTextContent("FALLBACK");

    // Listener moet geregistreerd zijn
    expect(authChangeMock).toHaveBeenCalledTimes(1);
    // RPC één keer aangeroepen (initial mount-fetch)
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  test("B. SIGNED_IN-event triggert re-fetch → config update zichtbaar", async () => {
    // Eerste fetch leeg (anon), tweede fetch gevuld
    rpcMock
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValue({
        data: [
          { key: "label.klanten.fase.4.titel", value: "Verbeteracties", category: "label", tenant_id: null },
        ],
        error: null,
      });

    // Capture de listener-callback
    let capturedCb;
    authChangeMock.mockImplementation((cb) => {
      capturedCb = cb;
      return { data: { subscription: { unsubscribe: unsubscribeMock } } };
    });

    let result;
    await act(async () => {
      result = render(<AppConfigProvider><TestConsumer /></AppConfigProvider>);
    });

    // Initial mount: fallback zichtbaar
    await waitFor(() => {
      expect(result.getByTestId("fase4-titel")).toHaveTextContent("FALLBACK");
    });

    // Trigger SIGNED_IN
    await act(async () => {
      capturedCb("SIGNED_IN", { user: { id: "user-1" } });
    });

    // Na re-fetch: DB-waarde zichtbaar
    await waitFor(() => {
      expect(result.getByTestId("fase4-titel")).toHaveTextContent("Verbeteracties");
    });

    // RPC 2x aangeroepen
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  test("C. Unmount → listener.unsubscribe wordt aangeroepen", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    let result;
    await act(async () => {
      result = render(<AppConfigProvider><TestConsumer /></AppConfigProvider>);
    });
    await waitFor(() => {
      expect(result.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(unsubscribeMock).not.toHaveBeenCalled();

    // Unmount
    await act(async () => {
      result.unmount();
    });

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
