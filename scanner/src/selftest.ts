import assert from "node:assert/strict";
import { npwr, shardRange } from "./shard.js";

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

console.log("Scanner self-test OK");
