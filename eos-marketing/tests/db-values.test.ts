import { describe, expect, it } from "vitest";
import { asJson, asNumbers, asStrings } from "@/lib/db-values";

describe("lectura uniforme de columnas", () => {
  it("JSON como objeto o texto", () => {
    expect(asJson({ a: 1 }, {})).toEqual({ a: 1 });
    expect(asJson('{"a":1}', {})).toEqual({ a: 1 });
    expect(asJson(null, [])).toEqual([]);
    expect(asJson("no es json", "x")).toBe("x");
  });
  it("text[] como arreglo o literal de Postgres", () => {
    expect(asStrings(["a", "b"])).toEqual(["a", "b"]);
    expect(asStrings('{admisiones,"con espacio","con, coma",NULL,"NULL"}')).toEqual(["admisiones", "con espacio", "con, coma", "NULL"]);
    expect(asStrings("{}")).toEqual([]);
    expect(asStrings(null)).toEqual([]);
  });
  it("números de int[], real[] o JSON", () => {
    expect(asNumbers([1, "2", null])).toEqual([1, 2]);
    expect(asNumbers("{0.5,-1,3e-2}")).toEqual([0.5, -1, 0.03]);
    expect(asNumbers("[4,5]")).toEqual([4, 5]);
    expect(asNumbers(undefined)).toEqual([]);
  });
});
