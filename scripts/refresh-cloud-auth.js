const {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
} = require("psn-api");

function readEnv(name) {
  return String(process.env[name] || "").trim();
}

async function exchangeFromNpsso() {
  const npsso = readEnv("PSN_NPSSO") || readEnv("NPSSO");
  if (!npsso) {
    throw new Error("Missing PSN_NPSSO.");
  }

  const accessCode = await exchangeNpssoForAccessCode(npsso);
  const tokens = await exchangeAccessCodeForAuthTokens(accessCode);
  return {
    source: "npsso",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    refreshTokenExpiresIn: tokens.refreshTokenExpiresIn,
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  const refreshToken = readEnv("PSN_REFRESH_TOKEN");

  if (refreshToken) {
    try {
      const tokens = await exchangeRefreshTokenForAuthTokens(refreshToken);
      process.stdout.write(
        JSON.stringify(
          {
            source: "refresh_token",
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            refreshTokenExpiresIn: tokens.refreshTokenExpiresIn,
            updatedAt: new Date().toISOString(),
          },
          null,
          2
        )
      );
      return;
    } catch (error) {
      console.error("[refresh-auth] Refresh token failed, falling back to NPSSO: " + error.message);
    }
  }

  process.stdout.write(JSON.stringify(await exchangeFromNpsso(), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
