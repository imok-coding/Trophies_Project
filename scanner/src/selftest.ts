import assert from "node:assert/strict";
import { npwr, shardRange } from "./shard.js";
import { badgeFromLegacyTitleId, badgeFromProductId, normalizeStoreTitle } from "./regionEvidence.js";

const shardCount = 20;
let expectedStart = 0;

for (let shard = 0; shard < shardCount; shard++) {
  const range = shardRange(shard, shardCount);
  assert.equal(range.start, expectedStart, `shard ${shard} should start at ${expectedStart}`);
  assert.ok(range.end >= range.start, `shard ${shard} should not be empty`);
  expectedStart = range.end + 1;
}

assert.equal(expectedStart, 100000, "20 shards should cover 00000..99999 exactly");
assert.deepEqual(shardRange(0, 20), { start: 0, end: 4999 });
assert.deepEqual(shardRange(19, 20), { start: 95000, end: 99999 });
assert.equal(npwr(0), "NPWR00000_00");
assert.equal(npwr(99999), "NPWR99999_00");
assert.throws(() => shardRange(-1, 20), /SHARD_INDEX/);
assert.throws(() => shardRange(20, 20), /SHARD_INDEX/);
assert.throws(() => shardRange(0, 0), /SHARD_COUNT/);
assert.equal(badgeFromProductId("UP0001-CUSA09311_00-GAME000000000000"), "NA");
assert.equal(badgeFromProductId("EP9000-PPSA07642_00-THELASTOFUSPART1"), "EU");
assert.equal(badgeFromProductId("JP9000-PPSA07643_00-THELASTOFUSPART1"), "JP");
assert.equal(badgeFromProductId("CP0000-CUSA00000_00-EXAMPLE00000000"), "CN");
assert.equal(badgeFromLegacyTitleId("NPEA00004_00"), "EU");
assert.equal(badgeFromLegacyTitleId("NPJA00001_00"), "JP");
assert.equal(badgeFromLegacyTitleId("NPUA00001_00"), "NA");
assert.equal(normalizeStoreTitle("THE EYE OF JUDGMENT™ Trophies"), "the eye of judgment");
assert.equal(normalizeStoreTitle("Marvel's Spider-Man 2 Trophy Set"), "marvels spider man 2");

console.log("Scanner self-test OK");
