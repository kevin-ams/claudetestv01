import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/app/(app)/meeting/actions", () => ({ meetingPulseAction: async () => "x" }));

describe("espera adaptable de la L10", () => {
  it("crece mientras nada cambia, tope 30 s, y vuelve a la base con un cambio", async () => {
    const { nextPulseDelay } = await import("@/app/(app)/meeting/[id]/meeting-hooks");
    let d = 8000;
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) seen.push((d = nextPulseDelay(d, 8000, false)));
    expect(seen).toEqual([12000, 18000, 27000, 30000, 30000, 30000]);
    expect(nextPulseDelay(30000, 8000, true)).toBe(8000);
    expect(nextPulseDelay(20000, 20000, false)).toBe(30000);
  });
});
