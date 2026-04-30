import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getTitleTrophyGroups,
  getTitleTrophies,
  getUserTitles,
  makeUniversalSearch
} from "psn-api";

export type Auth = { accessToken: string };
export type NpServiceName = "trophy" | "trophy2";

export type UserTrophyTitle = {
  npCommunicationId: string;
  npServiceName?: NpServiceName;
  trophySetVersion?: string;
  trophyTitleName?: string;
  trophyTitleIconUrl?: string;
  trophyTitlePlatform?: string;
  hasTrophyGroups?: boolean;
};

export class TitleLookupError extends Error {
  constructor(message: string, public retryable: boolean) {
    super(message);
    this.name = "TitleLookupError";
  }
}

function isRetryableApiError(error: any) {
  const status = Number(error?.status ?? error?.code ?? error?.httpStatus);
  if (status === 429 || status >= 500) return true;

  const message = String(error?.message ?? error ?? "").toLowerCase();
  if (message.includes("not found") || message.includes("resource not found")) return false;
  return message.includes("rate") || message.includes("timeout") || message.includes("temporar");
}

export async function authFromRefresh(refreshToken: string): Promise<Auth> {
  let tokens = await exchangeRefreshTokenForAuthTokens(refreshToken);

  if (!tokens.accessToken) {
    try {
      const accessCode = await exchangeNpssoForAccessCode(refreshToken);
      tokens = await exchangeAccessCodeForAuthTokens(accessCode);
    } catch (e) {
      throw new Error("Could not exchange PSN_REFRESH_TOKEN for an access token. Put either a valid PSN refresh token or a fresh NPSSO token in the GitHub secret PSN_REFRESH_TOKEN.");
    }
  }

  if (!tokens.accessToken) {
    throw new Error("Could not exchange PSN_REFRESH_TOKEN for an access token. Put either a valid PSN refresh token or a fresh NPSSO token in the GitHub secret PSN_REFRESH_TOKEN.");
  }

  return { accessToken: tokens.accessToken };
}

export async function accountIdFromPsnName(auth: Auth, psnName: string): Promise<string> {
  if (psnName === "me") return "me";

  const search = await makeUniversalSearch(auth, psnName, "SocialAllAccounts");
  const domainResponses = (search as any).domainResponses ?? (search as any).data?.domainResponses;
  if (!Array.isArray(domainResponses)) {
    throw new Error(`PSN search returned unexpected response: ${JSON.stringify(search).slice(0, 500)}`);
  }

  const accounts = domainResponses.flatMap((domain: any) => Array.isArray(domain.results) ? domain.results : []);
  const exact = accounts.find(account => account.socialMetadata?.onlineId?.toLowerCase() === psnName.toLowerCase());
  const account = exact ?? accounts[0];

  if (!account) {
    throw new Error(`Could not find PSN account ${psnName}`);
  }

  return account.socialMetadata.accountId;
}

export async function fetchUserTrophyTitles(auth: Auth, accountId: string): Promise<UserTrophyTitle[]> {
  const titlesByNpwr = new Map<string, UserTrophyTitle>();
  let offset = 0;
  const limit = 800;
  const services: NpServiceName[] = ["trophy2", "trophy"];

  for (const service of services) {
    offset = 0;

    while (true) {
      const page = await getUserTitles(auth, accountId, { limit, offset, npServiceName: service } as any);
      for (const title of page.trophyTitles) {
        titlesByNpwr.set(title.npCommunicationId, {
          npCommunicationId: title.npCommunicationId,
          npServiceName: title.npServiceName ?? service,
          trophySetVersion: title.trophySetVersion,
          trophyTitleName: title.trophyTitleName,
          trophyTitleIconUrl: title.trophyTitleIconUrl,
          trophyTitlePlatform: title.trophyTitlePlatform,
          hasTrophyGroups: title.hasTrophyGroups
        });
      }

      if (page.nextOffset == null || page.nextOffset <= offset) break;
      offset = page.nextOffset;
    }
  }

  return [...titlesByNpwr.values()];
}

export async function fetchTitleGroups(auth: Auth, npCommunicationId: string, npServiceName?: NpServiceName) {
  const services: NpServiceName[] = npServiceName ? [npServiceName] : ["trophy", "trophy2"];
  const errors: string[] = [];
  let retryable = false;

  for (const service of services) {
    try {
      const groups = await getTitleTrophyGroups(auth, npCommunicationId, { npServiceName: service });
      const raw = groups as any;
      if (raw.error) {
        if (isRetryableApiError(raw.error)) retryable = true;
        errors.push(`${service}: ${raw.error.message ?? JSON.stringify(raw.error)}`);
        continue;
      }

      if (!raw.trophyTitleName) {
        errors.push(`${service}: missing trophy title name`);
        continue;
      }

      raw.__resolvedNpServiceName = service;
      return groups;
    } catch (e) {
      if (isRetryableApiError(e)) retryable = true;
      errors.push(`${service}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new TitleLookupError(errors.length > 0 ? errors.join("; ") : "No title group response", retryable);
}

export async function fetchAllTrophies(auth: Auth, npCommunicationId: string, platform: string, npServiceName?: NpServiceName) {
  if (npServiceName) {
    return await getTitleTrophies(auth, npCommunicationId, "all", { npServiceName });
  }

  // For PS3/PS4/Vita you must set npServiceName "trophy" [3](https://psn-api.achievements.app/api-docs/title-trophies)
  const legacy = platform.includes("PS3") || platform.includes("PS4") || platform.includes("PSVITA") || platform.includes("VITA");
  if (legacy) {
    return await getTitleTrophies(auth, npCommunicationId, "all", { npServiceName: "trophy" });
  }
  return await getTitleTrophies(auth, npCommunicationId, "all");
}
