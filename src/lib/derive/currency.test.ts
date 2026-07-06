import { expect, test } from "vitest";
import { splitByCurrency } from "./currency";
import { account, deal } from "../../../tests/helpers/fixture";

const accounts = [
  account({ login: 111, currency: "USD" }),
  account({ login: 222, currency: "EUR" }),
  account({ login: 333, currency: "USD" }),
];

test("splits rows into one group per currency", () => {
  const rows = [
    deal({ account: 111 }),
    deal({ account: 222 }),
    deal({ account: 333 }),
  ];
  const groups = splitByCurrency(rows, accounts);
  expect([...groups.keys()].sort()).toEqual(["EUR", "USD"]);
  expect(groups.get("USD")).toHaveLength(2);
  expect(groups.get("EUR")).toHaveLength(1);
});

test("a login missing from accounts lands under '?'", () => {
  const groups = splitByCurrency([deal({ account: 999 })], accounts);
  expect(groups.get("?")).toHaveLength(1);
});
