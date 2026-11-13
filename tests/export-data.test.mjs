import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCsvBlob, CSV_MIME_TYPE, neutralizeFormula, toCsv } from "../lib/export-data.ts";

test("neutralizeFormula prefixa gatilhos e preserva números puros", () => {
  for (const v of ["=1+1", "+cmd", "-cmd", "@x", "\tx", "\rx"]) assert.equal(neutralizeFormula(v), `'${v}`);
  for (const v of ["-10", "+5,5", "12.5", "texto", ""]) assert.equal(neutralizeFormula(v), v);
});
test("toCsv: BOM, ';', CRLF e aspas", () => {
  const out = toCsv([["a", "b;c"], ['x"y', "=2+2"]]);
  assert.equal(out, '﻿a;"b;c"\r\n"x""y";\'=2+2\r\n');
});
test("buildCsvBlob", async () => {
  const blob = buildCsvBlob(["h1", "h2"], [["1", "2"]]);
  assert.equal(blob.type, CSV_MIME_TYPE);
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(bytes.subarray(3).toString("utf8"), "h1;h2\r\n1;2\r\n");
});
