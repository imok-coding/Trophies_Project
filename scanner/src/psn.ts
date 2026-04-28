import {
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
  // psn-api supports refresh token exchange [8](https://www.npmjs.com/package/psn-api)
  const tokens = await exchangeRefreshTokenForAuthTokens(refreshToken);
  return { accessToken: tokens.accessToken };
}

export async function accountIdFromPsnName(auth: Auth, psnName: string): Promise<string> {
  if (psnName === "me") return "me";

  const search = await makeUniversalSearch(auth, psnName, "SocialAllAccounts");
  const accounts = search.domainResponses.flatMap(domain => domain.results);
  const exact = accounts.find(account => account.socialMetadata.onlineId.toLowerCase() === psnName.toLowerCase());
  const account = exact ?? accounts[0];

  if (!account) {
    throw new Error(`Could not find PSN account ${psnName}`);
  }

  return account.socialMetadata.accountId;
}

export async function fetchUserTrophyTitles(auth: Auth, accountId: string): Promise<UserTrophyTitle[]> {
  const titles: UserTrophyTitle[] = [];
  let offset = 0;
  const limit = 800;

  while (true) {
    const page = await getUserTitles(auth, accountId, { limit, offset });
    titles.push(...page.trophyTitles.map(title => ({
      npCommunicationId: title.npCommunicationId,
      npServiceName: title.npServiceName,
      trophySetVersion: title.trophySetVersion,
      trophyTitleName: title.trophyTitleName,
      trophyTitleIconUrl: title.trophyTitleIconUrl,
      trophyTitlePlatform: title.trophyTitlePlatform,
      hasTrophyGroups: title.hasTrophyGroups
    })));

    if (page.nextOffset == null || page.nextOffset <= offset) break;
    offset = page.nextOffset;
  }

  return titles;
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
