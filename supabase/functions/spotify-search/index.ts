// supabase/functions/spotify-search/index.ts

import { serve } from "std/http";
import { corsHeaders } from "../_shared/cors.ts";

const SPOTIFY_CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID") || "";
const SPOTIFY_CLIENT_SECRET = Deno.env.get("SPOTIFY_CLIENT_SECRET") || "";

async function getSpotifyAccessToken() {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + btoa(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET),
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Gagal mendapat token Spotify: ${response.statusText}`);
  }
  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query) {
      throw new Error("Query pencarian dibutuhkan.");
    }

    const accessToken = await getSpotifyAccessToken();

    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10&market=ID`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error("Gagal mencari lagu di Spotify.");
    }

    const searchData = await searchResponse.json();

    const tracks = searchData.tracks.items.map((item: any) => ({
      trackId: item.id,
      trackName: item.name,
      artistName: item.artists.map((artist: any) => artist.name).join(", "),
      albumArtUrl: item.album.images[0]?.url || null,
    }));

    return new Response(JSON.stringify(tracks), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});