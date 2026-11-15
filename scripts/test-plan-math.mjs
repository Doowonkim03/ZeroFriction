import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const math = require("./plan-math.js");

assert.deepEqual(math.weeklyTime("Under 1 hour"), { hours: 0.5, label: "0.5 hours" });
assert.deepEqual(math.weeklyTime("1 to 3 hours"), { hours: 2, label: "2 hours" });
assert.deepEqual(math.weeklyTime("3 to 6 hours"), { hours: 4.5, label: "4.5 hours" });
assert.deepEqual(math.weeklyTime("More than 6 hours"), { hours: 6, label: "6+ hours" });
assert.deepEqual(math.savingRange(undefined, 40), { low: 20, high: 40 });
assert.deepEqual(math.savingRange(2, 80), { low: 10, high: 60 });
assert.deepEqual(math.savingRange(40, 20), { low: 40, high: 41 });

const estimate = math.savings(4.5, 20, 40);
assert.equal(estimate.sentence, "Roughly 0.9 to 1.8 hours a week.");
assert.equal(estimate.annualLow, 47);
assert.equal(estimate.annualHigh, 94);
assert.equal(estimate.midpointPercent, 30);
assert.equal(math.combinedHighHours(4.5, [
  { saving_percent_low: 20, saving_percent_high: 40 },
  { saving_percent_low: 20, saving_percent_high: 40 }
]), 2.7);

const coachHtml = await readFile(new URL("../ZeroFriction AI Coach.html", import.meta.url), "utf8");
const catalogMatch = coachHtml.match(/window\.ZF_DATA\s*=\s*(\{.*?\});/s);
assert.ok(catalogMatch, "The coach page should define window.ZF_DATA.");
JSON.parse(catalogMatch[1]);

console.log("Plan math and coach catalog checks passed.");
