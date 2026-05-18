/**
 * 11.U Block 1 — RTL voor nieuwe RFC-007-rev2 service-handlers.
 *
 * 4 cases per instructie §5:
 *  1. dismissPainPoint(canvasId, ppId, motivation>=20) → pp dismissed + URL/body correct
 *  2. dismissPainPoint motivation < 20 chars → backend 400 → service returnt error
 *  3. createIntentPainPointLink (zelfde canvas, valid) → link created + URL/body correct
 *  4. createIntentPainPointLink cross-canvas → backend trigger blokkeert → error
 *
 * Pattern: mock apiFetch (fetch-wrapper) en valideer dat de juiste URL + body
 * worden meegegeven, met fictieve responses voor backend-gedrag. Dit is een
 * service-unit-test (geen volledige integratie tegen prod-DB).
 */

import {
  dismissPainPoint,
  restorePainPoint,
  createIntentPainPointLink,
  deleteIntentPainPointLink,
  makeIntentDefinitief,
  dismissIntent,
  getCoverageGauge,
} from "../services/klanten.service";

// Mock apiClient
jest.mock("../../../shared/services/apiClient", () => ({
  apiFetch: jest.fn(),
}));

import { apiFetch } from "../../../shared/services/apiClient";

function mockResponse({ status = 200, body = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

beforeEach(() => {
  apiFetch.mockReset();
});

describe("11.U Block 1 — klanten.service RFC-007-rev2 handlers", () => {
  test("1. dismissPainPoint(id, motivation≥20) → POST + body correct + pp returned", async () => {
    const ppRow = { id: "pp-1", dismissed_at: "2026-05-19T10:00:00Z", dismissal_motivation: "x".repeat(30), coverage_status: "dismissed" };
    apiFetch.mockResolvedValueOnce(mockResponse({ status: 200, body: { pain_point: ppRow } }));

    const result = await dismissPainPoint("pp-1", "Niet meer relevant na herfasering");

    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = apiFetch.mock.calls[0];
    expect(url).toBe("/api/klanten/pain_points?id=pp-1&action=dismiss");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ motivation: "Niet meer relevant na herfasering" });
    expect(result.data).toEqual(ppRow);
    expect(result.error).toBeNull();
  });

  test("2. dismissPainPoint(id, motivation<20) → backend 400 → service returnt error", async () => {
    apiFetch.mockResolvedValueOnce(mockResponse({
      status: 400,
      body: { error: "motivation moet minimaal 20 tekens zijn" },
    }));

    const result = await dismissPainPoint("pp-1", "te kort");

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toMatch(/motivation moet minimaal 20/i);
  });

  test("3. createIntentPainPointLink valid → POST + body + link returned", async () => {
    const linkRow = { id: "link-1", intent_id: "int-1", pain_point_id: "pp-1" };
    apiFetch.mockResolvedValueOnce(mockResponse({ status: 201, body: { link: linkRow } }));

    const result = await createIntentPainPointLink("int-1", "pp-1");

    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = apiFetch.mock.calls[0];
    expect(url).toBe("/api/klanten/improvement_intents?id=int-1&action=create_pain_link");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ pain_point_id: "pp-1" });
    expect(result.data).toEqual(linkRow);
    expect(result.error).toBeNull();
  });

  test("4. createIntentPainPointLink cross-canvas → backend trigger blokkeert → service returnt error", async () => {
    apiFetch.mockResolvedValueOnce(mockResponse({
      status: 400,
      body: { error: "cross-canvas-koppeling niet toegestaan" },
    }));

    const result = await createIntentPainPointLink("int-1", "pp-other-canvas");

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toMatch(/cross-canvas/i);
  });

  // Extra dekking — niet uit instructie-strict 4-list maar relevant voor coverage
  test("5. restorePainPoint roept juiste URL aan zonder body", async () => {
    apiFetch.mockResolvedValueOnce(mockResponse({ status: 200, body: { pain_point: { id: "pp-1", dismissed_at: null } } }));
    await restorePainPoint("pp-1");
    const [url, opts] = apiFetch.mock.calls[0];
    expect(url).toBe("/api/klanten/pain_points?id=pp-1&action=restore");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeUndefined();
  });

  test("6. deleteIntentPainPointLink roept POST action=delete_pain_link aan", async () => {
    apiFetch.mockResolvedValueOnce(mockResponse({ status: 204 }));
    await deleteIntentPainPointLink("int-1", "pp-1");
    const [url, opts] = apiFetch.mock.calls[0];
    expect(url).toBe("/api/klanten/improvement_intents?id=int-1&action=delete_pain_link");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ pain_point_id: "pp-1" });
  });

  test("7. makeIntentDefinitief roept nieuwe action=make_definitief aan", async () => {
    apiFetch.mockResolvedValueOnce(mockResponse({ status: 200, body: { intent: { id: "int-1", status: "definitief" } } }));
    const result = await makeIntentDefinitief("int-1");
    const [url] = apiFetch.mock.calls[0];
    expect(url).toContain("action=make_definitief");
    expect(result.data.status).toBe("definitief");
  });

  test("8. dismissIntent met motivation roept action=dismiss aan", async () => {
    apiFetch.mockResolvedValueOnce(mockResponse({ status: 200, body: { intent: { id: "int-1", status: "dismissed" } } }));
    const result = await dismissIntent("int-1", "Achterhaald door strategische pivot");
    const [url, opts] = apiFetch.mock.calls[0];
    expect(url).toContain("action=dismiss");
    expect(JSON.parse(opts.body)).toEqual({ motivation: "Achterhaald door strategische pivot" });
    expect(result.data.status).toBe("dismissed");
  });

  test("9. getCoverageGauge returnt counts per status", async () => {
    apiFetch.mockResolvedValueOnce(mockResponse({
      status: 200,
      body: { gauge: { open: 5, addressed: 3, dismissed: 2, total: 10 } },
    }));
    const result = await getCoverageGauge("canvas-1");
    const [url] = apiFetch.mock.calls[0];
    expect(url).toContain("action=coverage_gauge");
    expect(url).toContain("canvas_id=canvas-1");
    expect(result.data).toEqual({ open: 5, addressed: 3, dismissed: 2, total: 10 });
  });
});
