import { expect, test } from "vitest";
import { money, num, pct, ratio, signedMoney } from "./format";

test("money is deterministic: grouped, 2 dp, code suffix", () => {
  expect(money(1234.5, "USD")).toBe("1,234.50 USD");
  expect(money(-987.654, "EUR")).toBe("-987.65 EUR");
  expect(money(0, "USD")).toBe("0.00 USD");
});

test("signedMoney adds an explicit plus", () => {
  expect(signedMoney(12.4, "USD")).toBe("+12.40 USD");
  expect(signedMoney(-3, "USD")).toBe("-3.00 USD");
});

test("pct and ratio render null as n/a", () => {
  expect(pct(0.528)).toBe("52.8%");
  expect(pct(null)).toBe("n/a");
  expect(ratio(1.3612)).toBe("1.36");
  expect(ratio(null)).toBe("n/a");
});

test("num is grouped, 2 dp, no currency — swallows float noise", () => {
  expect(num(2434.4699999999993)).toBe("2,434.47");
  expect(num(-5)).toBe("-5.00");
  expect(num(0)).toBe("0.00");
});
