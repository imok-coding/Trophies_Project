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
  // Existence check + title/platform via trophy groups [3](https://psn-api.achievements.app/api-docs/title-trophies)
  if (npServiceName) {
    return await getTitleTrophyGroups(auth, npCommunicationId, { npServiceName });
  }

  try {
    return await getTitleTrophyGroups(auth, npCommunicationId);
  } catch (e) {
    return await getTitleTrophyGroups(auth, npCommunicationId, { npServiceName: "trophy" });
  }
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
