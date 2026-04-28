import { shardRange, npwr } from "./shard.js";
import { authFromRefresh, fetchTitleGroups, fetchAllTrophies } from "./psn.js";
import { getIgdbToken, igdbSearchGame } from "./igdb.js";
import { postIngest } from "./post.js";

function env(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (v == null) throw new Error(`Missing env ${name}`);
  return v;
}

const SHARD_INDEX = Number(env("SHARD_INDEX"));
const SHARD_COUNT = Number(env("SHARD_COUNT", "20"));
const BATCH_SIZE = Number(env("BATCH_SIZE", "200"));

const PSN_REFRESH_TOKEN = env("PSN_REFRESH_TOKEN");
const IGDB_CLIENT_ID = env("IGDB_CLIENT_ID");
const IGDB_CLIENT_SECRET = env("IGDB_CLIENT_SECRET");
const INGEST_URL = env("INGEST_URL");
const INGEST_SECRET = env("INGEST_SECRET");

async function sleep(ms: number) {
  await new Promise(r => setTimeout(r, ms));
}

async function main() {
  const range = shardRange(SHARD_INDEX, SHARD_COUNT);
  const auth = await authFromRefresh(PSN_REFRESH_TOKEN);

  const igdbTok = await getIgdbToken(IGDB_CLIENT_ID, IGDB_CLIENT_SECRET);
  const igdbBearer = igdbTok.access_token;

  // Cursor: optional simple approach (suggestion)
  // For a starter: scan from start to end in batches each run.
  // For production: store/load cursor from DB via another endpoint.
  let cursor = range.start;

  const games: any[] = [];
  const groups: any[] = [];
  const trophies: any[] = [];

  const end = Math.min(range.end, range.start + BATCH_SIZE - 1);

  for (let id = cursor; id <= end; id++) {
    const np = npwr(id);

    try {
      const g = await fetchTitleGroups(auth, np);

      // If it exists, psn-api gives title/platform in response [3](https://psn-api.achievements.app/api-docs/title-trophies)
      const title_name = (g as any).trophyTitleName ?? "";
      const title_platform = (g as any).trophyTitlePlatform ?? "";
      const trophy_set_ver = (g as any).trophySetVersion ?? "";
      const has_groups = (g as any).trophyGroups ? 1 : 0;

      let icon_url = "";
      // Not always available in this endpoint; keep empty if missing (suggestion)

      // IGDB enrichment (basic search by title)
      const meta = title_name ? await igdbSearchGame(IGDB_CLIENT_ID, igdbBearer, title_name) : {};

      games.push({
        npwr: np,
        title_name,
        title_platform,
        trophy_set_ver,
        has_groups,
        icon_url,
        igdb_id: meta.igdb_id,
        igdb_name: meta.igdb_name,
        first_release: meta.first_release
      });

      // Save trophy groups
      const tg = (g as any).trophyGroups ?? [];
      for (const gr of tg) {
        groups.push({
          npwr: np,
          group_id: gr.trophyGroupId,
          group_name: gr.trophyGroupName ?? "",
          detail: gr.trophyGroupDetail ?? "",
          icon_url: gr.trophyGroupIconUrl ?? "",
          defined_total: gr.definedTrophies?.total ?? null
        });
      }

      // Fetch trophies (all groups)
      const trophyResp = await fetchAllTrophies(auth, np, title_platform);
      const list = (trophyResp as any).trophies ?? [];

      // NOTE: When fetching "all", trophies may include group identifiers (implementation varies).
      // If group_id is missing, default to "default" (suggestion).
      for (const t of list) {
        trophies.push({
          npwr: np,
          group_id: t.trophyGroupId ?? "default",
          trophy_id: t.trophyId,
          trophy_name: t.trophyName ?? "",
          trophy_detail: t.trophyDetail ?? "",
          trophy_type: t.trophyType ?? "bronze",
          hidden: t.trophyHidden ? 1 : 0,
          icon_url: t.trophyIconUrl ?? ""
        });
      }

      // Gentle pacing (suggestion)
      await sleep(250);
    } catch (e) {
      // Most NPWR IDs will not exist; treat errors as "not found" (suggestion)
      await sleep(100);
      continue;
    }
  }

  const payload = {
    games,
    groups,
    trophies,
    scan_state: {
      shard_index: SHARD_INDEX,
      cursor: end + 1
    }
  };

  await postIngest(INGEST_URL, INGEST_SECRET, payload);
  console.log(`Shard ${SHARD_INDEX} posted ${games.length} games.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});