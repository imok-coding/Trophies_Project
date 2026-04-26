export function shardRange(shardIndex: number, shardCount: number) {
  const total = 100000; // 00000..99999
  const size = Math.floor(total / shardCount); // 5000 if shardCount=20
  const start = shardIndex * size;
  const end = shardIndex === shardCount - 1 ? total - 1 : (start + size - 1);
  return { start, end };
}

export function npwr(id: number) {
  return `NPWR${String(id).padStart(5, "0")}_00`;
}