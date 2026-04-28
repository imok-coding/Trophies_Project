export function shardRange(shardIndex: number, shardCount: number) {
  if (!Number.isInteger(shardCount) || shardCount < 1) {
    throw new Error("SHARD_COUNT must be a positive integer");
  }

  if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardCount) {
    throw new Error("SHARD_INDEX must be an integer from 0 to SHARD_COUNT - 1");
  }

  const total = 100000; // 00000..99999
  const size = Math.floor(total / shardCount); // 5000 if shardCount=20
  const start = shardIndex * size;
  const end = shardIndex === shardCount - 1 ? total - 1 : (start + size - 1);
  return { start, end };
}

export function npwr(id: number) {
  return `NPWR${String(id).padStart(5, "0")}_00`;
}
