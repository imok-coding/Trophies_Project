import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getTitleTrophyGroups,
  getTitleTrophies,
  getUserTitles,
  makeUniversalSearch
} from "psn-api";

export type Auth = { accessToken: string; refreshSource?: string };
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

export class PsnRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PsnRetryableError";
  }
}

function isRetryableApiError(error: any) {
  if (error instanceof PsnRetryableError) return true;

  const message = String(error?.message ?? error ?? "").toLowerCase();
  if (message.includes("not found") || message.includes("resource not found")) return false;
  if (message.includes("missing trophy title name")) return false;

  const status = Number(error?.status ?? error?.code ?? error?.httpStatus);
  if (status === 429 || status >= 500) return true;

  return message.includes("rate") || message.includes("timeout") || message.includes("temporar");
}

function isExpiredTokenError(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  const status = Number(error?.status ?? error?.code ?? error?.httpStatus);
  return status === 401 || message.includes("expired token") || message.includes("token expired");
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

  return { accessToken: tokens.accessToken, refreshSource: refreshToken };
}

async function refreshAuth(auth: Auth) {
  if (!auth.refreshSource) {
    throw new PsnRetryableError("PSN access token expired and no refresh source is available.");
  }

  try {
    const next = await authFromRefresh(auth.refreshSource);
    auth.accessToken = next.accessToken;
    auth.refreshSource = next.refreshSource;
  } catch (e) {
    throw new PsnRetryableError(`PSN access token expired and refresh failed: ${e instanceof Error ? e.message : String(e)}`);
  }
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
      let page;
      try {
        page = await getUserTitles(auth, accountId, { limit, offset, npServiceName: service } as any);
      } catch (e) {
        if (!isExpiredTokenError(e)) throw e;
        await refreshAuth(auth);
        page = await getUserTitles(auth, accountId, { limit, offset, npServiceName: service } as any);
      }
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
      let groups = await getTitleTrophyGroups(auth, npCommunicationId, { npServiceName: service });
      const raw = groups as any;
      if (isExpiredTokenError(raw.error)) {
        await refreshAuth(auth);
        groups = await getTitleTrophyGroups(auth, npCommunicationId, { npServiceName: service });
      }
      const refreshedRaw = groups as any;
      if (refreshedRaw.error) {
        if (isRetryableApiError(refreshedRaw.error)) retryable = true;
        errors.push(`${service}: ${refreshedRaw.error.message ?? JSON.stringify(refreshedRaw.error)}`);
        continue;
      }

      if (!refreshedRaw.trophyTitleName) {
        errors.push(`${service}: missing trophy title name`);
        continue;
      }

      refreshedRaw.__resolvedNpServiceName = service;
      return groups;
    } catch (e) {
      if (isExpiredTokenError(e)) {
        try {
          await refreshAuth(auth);
          const groups = await getTitleTrophyGroups(auth, npCommunicationId, { npServiceName: service });
          const raw = groups as any;
          if (!raw.error && raw.trophyTitleName) {
            raw.__resolvedNpServiceName = service;
            return groups;
          }
          if (raw.error) errors.push(`${service}: ${raw.error.message ?? JSON.stringify(raw.error)}`);
          else errors.push(`${service}: missing trophy title name`);
          continue;
        } catch (refreshError) {
          retryable = true;
          errors.push(`${service}: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`);
          continue;
        }
      }
      if (isRetryableApiError(e)) retryable = true;
      errors.push(`${service}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const message = errors.length > 0 ? errors.join("; ") : "No title group response";
  const onlyMissing = errors.length > 0 && errors.every(error =>
    /resource not found|not found|missing trophy title name/i.test(error)
  );
  throw new TitleLookupError(message, retryable && !onlyMissing);
}

export async function fetchAllTrophies(auth: Auth, npCommunicationId: string, platform: string, npServiceName?: NpServiceName) {
  async function getTrophies() {
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

  if (npServiceName) {
    try {
      return await getTrophies();
    } catch (e) {
      if (!isExpiredTokenError(e)) throw e;
      await refreshAuth(auth);
      return await getTrophies();
    }
  }

  try {
    return await getTrophies();
  } catch (e) {
    if (!isExpiredTokenError(e)) throw e;
    await refreshAuth(auth);
    return await getTrophies();
  }
}
