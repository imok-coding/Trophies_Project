type IgdbToken = { access_token: string; expires_in: number; token_type: string };

export async function getIgdbToken(clientId: string, clientSecret: string) {
  const url = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`IGDB token error: ${res.status}`);
  return (await res.json()) as IgdbToken;
}

export async function igdbSearchGame(
  clientId: string,
  bearer: string,
  name: string
): Promise<{ igdb_id?: number; igdb_name?: string; first_release?: string }> {
  // Simple heuristic: search by name and grab first match.
  // Suggestion: improve with platform filters later.
  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      "Authorization": `Bearer ${bearer}`,
      "Content-Type": "text/plain"
    },
    body: `search "${name.replace(/"/g, "")}";
fields id,name,first_release_date;
limit 1;`
  });

  if (!res.ok) return {};
  const arr = (await res.json()) as Array<{ id: number; name: string; first_release_date?: number }>;
  const g = arr[0];
  if (!g) return {};
  return {
    igdb_id: g.id,
    igdb_name: g.name,
    first_release: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : undefined
  };
}