import {
  exchangeRefreshTokenForAuthTokens,
  getTitleTrophyGroups,
  getTitleTrophies
} from "psn-api";

export type Auth = { accessToken: string };

export async function authFromRefresh(refreshToken: string): Promise<Auth> {
  // psn-api supports refresh token exchange [8](https://www.npmjs.com/package/psn-api)
  const tokens = await exchangeRefreshTokenForAuthTokens(refreshToken);
  return { accessToken: tokens.accessToken };
}

export async function fetchTitleGroups(auth: Auth, npCommunicationId: string) {
  // Existence check + title/platform via trophy groups [3](https://psn-api.achievements.app/api-docs/title-trophies)
  return await getTitleTrophyGroups(auth, npCommunicationId);
}

export async function fetchAllTrophies(auth: Auth, npCommunicationId: string, platform: string) {
  // For PS3/PS4/Vita you must set npServiceName "trophy" [3](https://psn-api.achievements.app/api-docs/title-trophies)
  const legacy = platform.includes("PS3") || platform.includes("PS4") || platform.includes("PSVITA") || platform.includes("VITA");
  if (legacy) {
    return await getTitleTrophies(auth, npCommunicationId, "all", { npServiceName: "trophy" });
  }
  return await getTitleTrophies(auth, npCommunicationId, "all");
}
