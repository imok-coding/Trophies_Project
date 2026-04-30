import { shardRange, npwr } from "./shard.js";
import {
  accountIdFromPsnName,
  authFromRefresh,
  fetchAllTrophies,
  fetchTitleGroups,
  fetchUserTrophyTitles,
  PsnRetryableError,
  TitleLookupError,
  type UserTrophyTitle
} from "./psn.js";
import { getIgdbToken, igdbSearchGame } from "./igdb.js";
import { getAntiBotCookie, postIngest } from "./post.js";

function env(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (v == null) throw new Error(`Missing env ${name}`);
  return v;
}

const SHARD_INDEX = Number(env("SHARD_INDEX"));
const SHARD_COUNT = Number(env("SHARD_COUNT", "20"));
const BATCH_SIZE = Number(env("BATCH_SIZE", "5000"));
const NPWRS = process.env.NPWRS ?? "";
const PSN_NAME = process.env.PSN_NAME ?? "";

const PSN_REFRESH_TOKEN = env("PSN_REFRESH_TOKEN");
const IGDB_CLIENT_ID = env("IGDB_CLIENT_ID");
const IGDB_CLIENT_SECRET = env("IGDB_CLIENT_SECRET");
const INGEST_URL = env("INGEST_URL");
const INGEST_SECRET = env("INGEST_SECRET");

async function sleep(ms: number) {
  await new Promise(r => setTimeout(r, ms));
}

async function getScanCursor(ingestUrl: string, secret: string, shardIndex: number): Promise<number | undefined> {
  const stateUrl = new URL(ingestUrl);
  stateUrl.pathname = stateUrl.pathname.replace(/\/ingest\.php$/, "/state.php");
  stateUrl.searchParams.set("shard_index", String(shardIndex));

  const cookie = await getAntiBotCookie(stateUrl.toString());
  const res = await fetch(stateUrl, {
    headers: {
      "X-Ingest-Secret": secret,
      "User-Agent": "Mozilla/5.0",
      ...(cookie ? { "Cookie": cookie } : {})
    }
  });

  if (!res.ok) return undefined;
  const data = await res.json().catch(() => undefined) as { cursor?: number | null } | undefined;
  return typeof data?.cursor === "number" ? data.cursor : undefined;
}

async function main() {
  const range = shardRange(SHARD_INDEX, SHARD_COUNT);
  const auth = await authFromRefresh(PSN_REFRESH_TOKEN);

  const igdbTok = await getIgdbToken(IGDB_CLIENT_ID, IGDB_CLIENT_SECRET);
  const igdbBearer = igdbTok.access_token;

  async function ingestScanResult(
    games: any[],
    groups: any[],
    trophies: any[],
    nextCursor?: number,
    removed?: any[]
  ) {
    const payload: any = {
      games,
      groups,
      trophies,
      removed: removed ?? []
    };

    if (nextCursor != null) {
      payload.scan_state = {
        shard_index: SHARD_INDEX,
        cursor: nextCursor
      };
    }

    return await postIngest(INGEST_URL, INGEST_SECRET, payload);
  }

  const explicitNpwrs = NPWRS.split(/[\s,]+/).map(v => v.trim()).filter(Boolean);
  const scanTitles: UserTrophyTitle[] = [];
  let cursor = range.start;
  let end = range.start - 1;

  if (PSN_NAME) {
    const accountId = await accountIdFromPsnName(auth, PSN_NAME);
    scanTitles.push(...await fetchUserTrophyTitles(auth, accountId));
    console.log(`Resolved ${PSN_NAME} to ${accountId}; scanning ${scanTitles.length} trophy titles.`);
    for (const title of scanTitles.slice(0, 25)) {
      console.log(`PSN title: ${title.npCommunicationId} ${title.npServiceName ?? ""} ${title.trophyTitleName ?? ""}`);
    }
    if (scanTitles.length > 25) {
      console.log(`PSN title log truncated; ${scanTitles.length - 25} more titles.`);
    }
  } else if (explicitNpwrs.length > 0) {
    scanTitles.push(...explicitNpwrs.map(npCommunicationId => ({ npCommunicationId })));
  } else {
    cursor = range.start;
    end = Math.min(range.end, cursor + BATCH_SIZE - 1);
    for (let id = cursor; id <= end; id++) {
      scanTitles.push({ npCommunicationId: npwr(id) });
    }
  }

  const games: any[] = [];
  const groups: any[] = [];
  const trophies: any[] = [];
  const pendingTitleByNpwr = new Map<string, string>();
  let postedGames = 0;
  let invalidCount = 0;

  function errorSummary(e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }

  function logNpwrResult(currentNpwr: string, result: string) {
    console.log(`${currentNpwr}: ${result}`);
  }

  for (let index = 0; index < scanTitles.length; index++) {
    const scanTitle = scanTitles[index];
    const np = scanTitle.npCommunicationId;
    const numericMatch = np.match(/^NPWR(\d{5})_00$/);
    const nextCursor = numericMatch && explicitNpwrs.length === 0 && !PSN_NAME
      ? Number(numericMatch[1]) + 1
      : undefined;
    const gameRows: any[] = [];
    const groupRows: any[] = [];
    const trophyRows: any[] = [];

    try {
      const g = await fetchTitleGroups(auth, np, scanTitle.npServiceName);

      // If it exists, psn-api gives title/platform in response [3](https://psn-api.achievements.app/api-docs/title-trophies)
      const title_name = (g as any).trophyTitleName ?? scanTitle.trophyTitleName ?? "";
      const title_platform = (g as any).trophyTitlePlatform ?? scanTitle.trophyTitlePlatform ?? "";
      const trophy_set_ver = (g as any).trophySetVersion ?? scanTitle.trophySetVersion ?? "";
      const has_groups = ((g as any).trophyGroups || scanTitle.hasTrophyGroups) ? 1 : 0;
      if (!title_name) {
        throw new Error("Missing trophy title name");
      }

      const icon_url = (g as any).trophyTitleIconUrl ?? scanTitle.trophyTitleIconUrl ?? "";

      // IGDB enrichment (basic search by title)
      const meta = title_name ? await igdbSearchGame(IGDB_CLIENT_ID, igdbBearer, title_name) : {};

      gameRows.push({
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
        groupRows.push({
          npwr: np,
          group_id: gr.trophyGroupId,
          group_name: gr.trophyGroupName ?? "",
          detail: gr.trophyGroupDetail ?? "",
          icon_url: gr.trophyGroupIconUrl ?? "",
          defined_total: gr.definedTrophies?.total ?? null
        });
      }

      // Fetch trophies (all groups)
      const resolvedNpServiceName = scanTitle.npServiceName ?? (g as any).__resolvedNpServiceName;
      const trophyResp = await fetchAllTrophies(auth, np, title_platform, resolvedNpServiceName);
      const list = (trophyResp as any).trophies ?? [];

      // NOTE: When fetching "all", trophies may include group identifiers (implementation varies).
      // If group_id is missing, default to "default" (suggestion).
      for (const t of list) {
        trophyRows.push({
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
    } catch (e) {
      const retryable = (e instanceof TitleLookupError && e.retryable) || e instanceof PsnRetryableError;
      if (retryable) {
        logNpwrResult(np, `Error - ${errorSummary(e).replaceAll("\n", " ")}`);
        if (explicitNpwrs.length === 0 && !PSN_NAME) {
          throw e;
        }

        await sleep(100);
        continue;
      }

      invalidCount++;
      if (explicitNpwrs.length === 0 && !PSN_NAME && nextCursor != null) {
        const ingest = await ingestScanResult(
          [],
          [],
          [],
          nextCursor,
          [{ npwr: np, reason: errorSummary(e) }]
        );
        logNpwrResult(np, ingest.results?.[np] === "removed" ? "Removed" : "Invalid");
      } else {
        logNpwrResult(np, "Invalid");
      }

      await sleep(100);
      continue;
    }

    if (explicitNpwrs.length === 0 && !PSN_NAME) {
      const ingest = await ingestScanResult(gameRows, groupRows, trophyRows, nextCursor);
      postedGames += gameRows.length;
      const result = ingest.results?.[np];
      logNpwrResult(np, result === "updated" ? "Updated" : String(gameRows[0]?.title_name ?? "Unknown"));
    } else {
      games.push(...gameRows);
      groups.push(...groupRows);
      trophies.push(...trophyRows);
      postedGames = games.length;
      pendingTitleByNpwr.set(np, String(gameRows[0]?.title_name ?? "Unknown"));
    }

    await sleep(250);
  }

  if (explicitNpwrs.length > 0 || PSN_NAME) {
    const ingest = await ingestScanResult(games, groups, trophies);
    for (const [np, title] of pendingTitleByNpwr) {
      const result = ingest.results?.[np];
      logNpwrResult(np, result === "updated" ? "Updated" : title);
    }
    postedGames = games.length;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
