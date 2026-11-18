// Zone sync — pulls ESPN public soccer JSON into Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";

const SECRET = Deno.env.get("ZONE_SYNC_SECRET") ?? "";
const LEAGUES: Record<string, { espn: string; name: string; country: string | null; type: string }> = {
  PL: { espn: "eng.1", name: "Premier League", country: "England", type: "LEAGUE" },
  PD: { espn: "esp.1", name: "LaLiga", country: "Spain", type: "LEAGUE" },
  SA: { espn: "ita.1", name: "Serie A", country: "Italy", type: "LEAGUE" },
  BL1: { espn: "ger.1", name: "Bundesliga", country: "Germany", type: "LEAGUE" },
  FL1: { espn: "fra.1", name: "Ligue 1", country: "France", type: "LEAGUE" },
  CL: { espn: "uefa.champions", name: "Champions League", country: "Europe", type: "CUP" },
};
const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
const V2 = "https://site.api.espn.com/apis/v2/sports/soccer/";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function getJSON(url: string) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "ZoneAnalytics/1.0" } });
      if (r.ok) return await r.json();
    } catch (_) { /* retry */ }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  throw new Error("fetch failed " + url);
}

function must(res: { error: unknown }, ctx: string) {
  if (res.error) throw new Error(ctx + ": " + JSON.stringify(res.error));
}

function statusOf(t: { state?: string; name?: string; completed?: boolean }) {
  const n = t?.name || "";
  if (n.includes("POSTPONED") || n.includes("SUSPENDED") || n.includes("DELAYED")) return "POSTPONED";
  if (n.includes("CANCELED") || n.includes("ABANDONED")) return "CANCELLED";
  if (t?.state === "post" || t?.completed) return "FINISHED";
  if (t?.state === "in") return n.includes("HALFTIME") ? "PAUSED" : "LIVE";
  return "SCHEDULED";
}

function parseMinute(s?: string): { m: number | null; extra: number } {
  if (!s) return { m: null, extra: 0 };
  const mm = s.match(/(\d+)'?(?:\+(\d+))?/);
  if (!mm) return { m: null, extra: 0 };
  return { m: parseInt(mm[1]), extra: mm[2] ? parseInt(mm[2]) : 0 };
}

// Simple location-based xG model (distance + goal-mouth angle), Opta-style 0..100 coords.
function xgModel(x: number, y: number, header: boolean, penalty: boolean) {
  if (penalty) return 0.76;
  const dx = (100 - x) * 1.05, dy = (y - 50) * 0.68;
  const d = Math.sqrt(dx * dx + dy * dy);
  let a = Math.atan2(7.32 * dx, dx * dx + dy * dy - (7.32 / 2) ** 2);
  if (a < 0) a += Math.PI;
  let logit = -0.966 + 1.16 * a - 0.1075 * d;
  if (header) logit -= 0.8;
  const p = 1 / (1 + Math.exp(-logit));
  return Math.max(0.01, Math.min(0.95, Math.round(p * 1000) / 1000));
}

function classify(type: string): string | null {
  const t = type.toLowerCase();
  if (t.includes("own goal")) return "own_goal";
  if (t.startsWith("penalty - scored")) return "penalty_goal";
  if (t.startsWith("penalty - saved") || t.startsWith("penalty - missed")) return "penalty_missed";
  if (t.startsWith("goal")) return "goal";
  if (t.includes("shot on target") || t.includes("saved")) return "shot_on";
  if (t.includes("shot off target") || t.includes("missed")) return "shot_off";
  if (t.includes("shot blocked") || t.includes("blocked")) return "shot_blocked";
  if (t.includes("woodwork") || t.includes("post") || t.includes("bar")) return "woodwork";
  if (t.includes("yellow")) return t.includes("second") ? "red" : "yellow";
  if (t.includes("red card")) return "red";
  if (t.includes("substitution")) return "sub";
  if (t.startsWith("var")) return "var";
  if (t.includes("corner")) return "corner";
  if (t.includes("offside")) return "offside";
  if (t === "halftime" || t.includes("end regular") || t.includes("kickoff") || t.includes("start 2nd")) return "period";
  return null;
}
const SHOT = new Set(["goal", "penalty_goal", "penalty_missed", "shot_on", "shot_off", "shot_blocked", "woodwork"]);

function statMap(arr: Array<{ name: string; value?: number; displayValue?: string }> = []) {
  const o: Record<string, number> = {};
  for (const s of arr) {
    const v = s.value ?? parseFloat(s.displayValue ?? "");
    if (!Number.isNaN(v)) o[s.name] = v;
  }
  return o;
}

async function ensureSeason(code: string, season: any) {
  const L = LEAGUES[code];
  must(await sb.from("competitions").upsert({ id: code, name: L.name, code, country: L.country, type: L.type }), "comp");
  const year = season?.year ?? new Date().getUTCFullYear();
  const id = `${code}-${year}`;
  must(await sb.from("seasons").upsert({
    id, competition_id: code, year,
    start_date: season?.startDate?.slice(0, 10) ?? null, end_date: season?.endDate?.slice(0, 10) ?? null,
  }), "season");
  return id;
}

async function upsertTeams(code: string, teams: any[]) {
  const rows = teams.map((t) => ({
    id: String(t.id), name: t.displayName || t.name, short_name: t.shortDisplayName || t.abbreviation,
    crest_url: t.logo || t.logos?.[0]?.href || null, country: LEAGUES[code].type === "LEAGUE" ? LEAGUES[code].country : null,
  }));
  if (!rows.length) return;
  if (code === "CL") must(await sb.from("teams").upsert(rows, { onConflict: "id", ignoreDuplicates: true }), "teams");
  else must(await sb.from("teams").upsert(rows), "teams");
}

async function processSummary(code: string, ev: any, matchRow: any) {
  const d = await getJSON(`${SITE}${LEAGUES[code].espn}/summary?event=${ev.id}`);
  const mid = String(ev.id);
  const comp = ev.competitions[0];
  const homeId = String(comp.competitors.find((c: any) => c.homeAway === "home").team.id);
  const awayId = String(comp.competitors.find((c: any) => c.homeAway === "away").team.id);
  const score: Record<string, number> = {};
  for (const c of comp.competitors) score[String(c.team.id)] = parseInt(c.score ?? "0") || 0;

  // ---- events (commentary preferred, has shots + coordinates) ----
  const plays: any[] = (d.commentary?.length ? d.commentary.map((c: any) => c.play).filter(Boolean) : d.keyEvents) || [];
  const rosterIds = new Set<string>();
  const lc = (x: any) => String(x || "").trim().toLowerCase();
  const nameId: Record<string, string> = {}, nameTeam: Record<string, string> = {}, teamByName: Record<string, string> = {};
  for (const r of d.rosters || []) for (const p of r.roster || []) {
    rosterIds.add(String(p.athlete.id)); nameId[lc(p.athlete.displayName)] = String(p.athlete.id); nameTeam[lc(p.athlete.displayName)] = String(r.team.id);
  }
  for (const c of comp.competitors) { teamByName[lc(c.team.displayName)] = String(c.team.id); teamByName[lc(c.team.name)] = String(c.team.id); }
  const keyById: Record<string, any> = {};
  for (const k of d.keyEvents || []) if (k.id) keyById[String(k.id)] = k;
  const events: any[] = [];
  const xgBy: Record<string, number> = {}, xgTeam: Record<string, number> = {};
  const seen = new Set<string>();
  for (const p of plays) {
    const type = classify(p.type?.text || "");
    if (!type || type === "corner" || type === "offside") continue;
    if (p.id && seen.has(String(p.id))) continue;
    if (p.id) seen.add(String(p.id));
    const mn = parseMinute(p.clock?.displayValue);
    const ke = p.id ? keyById[String(p.id)] : null;
    const n0 = lc(p.participants?.[0]?.athlete?.displayName);
    const pidRaw = p.participants?.[0]?.athlete?.id ?? ke?.participants?.[0]?.athlete?.id;
    const pid = pidRaw ? String(pidRaw) : (nameId[n0] || null);
    const tRaw = p.team?.id ?? ke?.team?.id;
    const teamId = tRaw ? String(tRaw) : (teamByName[lc(p.team?.displayName)] || (n0 ? nameTeam[n0] : null) || null);
    const raw: any = { extra: mn.extra, seq: events.length, clock: p.clock?.displayValue, period: p.period?.number, text: p.text, short: p.shortText,
      names: (p.participants || []).map((x: any) => x.athlete?.displayName), ids: (p.participants || []).map((x: any) => x.athlete?.id ? String(x.athlete.id) : (nameId[lc(x.athlete?.displayName)] || null)) };
    if (SHOT.has(type) && p.fieldPositionX != null) {
      let x = +p.fieldPositionX, y = +p.fieldPositionY;
      if (x < 50) { x = 100 - x; y = 100 - y; }
      const txt = (p.text || "").toLowerCase();
      const header = txt.includes("header");
      const pen = type.startsWith("penalty") || txt.includes("penalty");
      const xg = xgModel(x, y, header, pen);
      Object.assign(raw, { x, y, gy: p.goalPositionY ?? null, gz: p.goalPositionZ ?? null, xg, header, penalty: pen,
        foot: txt.includes("left footed") ? "L" : txt.includes("right footed") ? "R" : header ? "H" : null,
        assist: (txt.match(/assisted by ([^.]+?)(?: with| following|\.)/) || [])[1] || null });
      if (pid) xgBy[pid] = (xgBy[pid] || 0) + xg;
      if (teamId) xgTeam[teamId] = (xgTeam[teamId] || 0) + xg;
    }
    events.push({ match_id: mid, minute: mn.m, type, team_id: teamId,
      player_id: pid && rosterIds.has(pid) ? pid : null, detail: p.text || p.shortText || p.type?.text, raw });
  }
  // xA via assist names
  const xaByName: Record<string, number> = {};
  for (const e of events) if (e.raw.assist && e.raw.xg) { const k = lc(e.raw.assist); xaByName[k] = (xaByName[k] || 0) + e.raw.xg; }

  // ---- players + player stats ----
  const players: any[] = [], pstats: any[] = [];
  const teamForm: Record<string, string> = {};
  for (const r of d.rosters || []) {
    const tid = String(r.team.id);
    teamForm[tid] = r.formation || "";
    const opp = tid === homeId ? awayId : homeId;
    const gf = score[tid] ?? 0, ga = score[opp] ?? 0;
    for (const p of r.roster || []) {
      const a = p.athlete; const id = String(a.id);
      const posAbbr = p.position?.abbreviation || "";
      players.push({ id, name: a.displayName, team_id: tid, position: p.position?.displayName || null,
        raw: { jersey: p.jersey, short: a.shortName, abbr: posAbbr, last: a.lastName } });
      const s = statMap(p.stats);
      let inM = p.starter ? 0 : null as number | null, outM = 90;
      for (const pl of p.plays || []) {
        const m = parseMinute(pl.clock?.displayValue).m;
        if (m == null) continue;
        if (pl.substitution) { if (p.subbedIn && inM == null) inM = m; else if (p.subbedOut) outM = m; }
        if (pl.redCard) outM = Math.min(outM, m);
      }
      if (p.subbedIn && inM == null) inM = 75;
      const minutes = inM == null ? 0 : Math.max(1, Math.min(90, outM) - inM);
      const goals = s.totalGoals || 0, assists = s.goalAssists || 0;
      const xg = Math.round((xgBy[id] || 0) * 100) / 100;
      const xa = Math.round((xaByName[lc(a.displayName)] || 0) * 100) / 100;
      let rating: number | null = null;
      if (minutes >= 10) {
        const g = posAbbr === "G" || posAbbr === "GK";
        const def = /^(CD|CB|LB|RB|D|SW|LWB|RWB|CD-L|CD-R)/.test(posAbbr) || (p.position?.displayName || "").includes("Defender");
        let rt = 6.3 + goals * (def ? 1.2 : 1.0) + assists * 0.7 + (s.shotsOnTarget || 0) * 0.15 + (s.totalShots || 0) * 0.04
          + xg * 0.4 + xa * 0.3 + (s.foulsSuffered || 0) * 0.05 - (s.foulsCommitted || 0) * 0.05
          - (s.yellowCards || 0) * 0.3 - (s.redCards || 0) * 1.5 - (s.ownGoals || 0) * 1.0 - (s.offsides || 0) * 0.05;
        rt += gf > ga ? 0.3 : gf < ga ? -0.25 : 0;
        if (g) rt += (s.saves || 0) * 0.25 - ga * 0.3 + (ga === 0 && minutes >= 60 ? 0.7 : 0);
        else if (def) rt += (ga === 0 && minutes >= 60 ? 0.5 : 0) - ga * 0.1;
        rt = rt * (0.85 + 0.15 * Math.min(1, minutes / 60));
        rating = Math.round(Math.max(3, Math.min(10, rt)) * 10) / 10;
      }
      pstats.push({ match_id: mid, player_id: id, team_id: tid, minutes, goals, assists, shots: s.totalShots ?? 0,
        shots_on_target: s.shotsOnTarget ?? 0, xg, xa, rating,
        raw: { s, starter: !!p.starter, subIn: !!p.subbedIn, subOut: !!p.subbedOut, place: p.formationPlace ?? null,
          jersey: p.jersey, abbr: posAbbr, pos: p.position?.displayName, inM, outM: inM == null ? null : outM } });
    }
  }
  if (players.length) must(await sb.from("players").upsert(players), "players");
  if (pstats.length) must(await sb.from("player_match_stats").upsert(pstats, { onConflict: "match_id,player_id" }), "pstats");

  // ---- team stats ----
  const tstats: any[] = [];
  for (const t of d.boxscore?.teams || []) {
    const tid = String(t.team.id); const s = statMap(t.statistics);
    const opp = tid === homeId ? awayId : homeId;
    tstats.push({ match_id: mid, team_id: tid, possession: s.possessionPct ?? null, shots: s.totalShots ?? null,
      shots_on_target: s.shotsOnTarget ?? null, xg: Math.round((xgTeam[tid] || 0) * 100) / 100,
      xga: Math.round((xgTeam[opp] || 0) * 100) / 100, passes: s.totalPasses ?? null,
      pass_accuracy: s.totalPasses ? Math.round((s.accuratePasses / s.totalPasses) * 1000) / 10 : null,
      corners: s.wonCorners ?? null, fouls: s.foulsCommitted ?? null, cards: (s.yellowCards || 0) + (s.redCards || 0),
      raw: { s, formation: teamForm[tid] || null } });
  }
  if (tstats.length) must(await sb.from("team_match_stats").upsert(tstats, { onConflict: "match_id,team_id" }), "tstats");

  must(await sb.from("match_events").delete().eq("match_id", mid), "evdel");
  if (events.length) must(await sb.from("match_events").insert(events), "events");

  // enrich match raw
  const gi = d.gameInfo || {};
  const raw = { ...(matchRow.raw || {}), venue: gi.venue?.fullName ?? matchRow.raw?.venue, city: gi.venue?.address?.city ?? null,
    attendance: gi.attendance ?? null, referee: gi.officials?.[0]?.displayName ?? null,
    synced_final: matchRow.status === "FINISHED" };
  must(await sb.from("matches").update({ raw }).eq("id", mid), "mraw");
  return { events: events.length, players: pstats.length };
}

async function processDate(code: string, date: string, force: boolean) {
  const sbd = await getJSON(`${SITE}${LEAGUES[code].espn}/scoreboard?dates=${date}`);
  const evs: any[] = sbd.events || [];
  const seasonId = await ensureSeason(code, sbd.leagues?.[0]?.season);
  if (!evs.length) return { date, matches: 0, summaries: 0 };
  const teams: any[] = [];
  for (const e of evs) for (const c of e.competitions[0].competitors) teams.push(c.team);
  await upsertTeams(code, teams);
  const ids = evs.map((e) => String(e.id));
  const { data: existing } = await sb.from("matches").select("id,status,raw").in("id", ids);
  const ex = new Map((existing || []).map((m: any) => [m.id, m]));
  const rows = evs.map((e) => {
    const c = e.competitions[0];
    const h = c.competitors.find((x: any) => x.homeAway === "home"), a = c.competitors.find((x: any) => x.homeAway === "away");
    const st = statusOf(e.status?.type);
    const old: any = ex.get(String(e.id));
    return {
      id: String(e.id), competition_id: code, season_id: seasonId, home_team_id: String(h.team.id), away_team_id: String(a.team.id),
      utc_date: e.date, status: st, matchday: null,
      stage: e.season?.slug || c.notes?.[0]?.headline || null,
      home_goals: st === "SCHEDULED" ? null : parseInt(h.score ?? "0"), away_goals: st === "SCHEDULED" ? null : parseInt(a.score ?? "0"),
      raw: { ...(old?.raw || {}), detail: e.status?.type?.shortDetail, clock: e.status?.displayClock, venue: c.venue?.fullName ?? old?.raw?.venue,
        homeForm: h.form, awayForm: a.form, homeColor: h.team.color, awayColor: a.team.color, note: c.notes?.[0]?.headline ?? null,
        homeStats: statMap(h.statistics), awayStats: statMap(a.statistics), shootout: c.shootoutScore ?? null,
        aggregate: c.series?.summary ?? null },
    };
  });
  must(await sb.from("matches").upsert(rows), "matches");
  let summaries = 0; const errors: string[] = [];
  for (const e of evs) {
    const row = rows.find((r) => r.id === String(e.id))!;
    if (row.status === "SCHEDULED" || row.status === "POSTPONED" || row.status === "CANCELLED") continue;
    const old: any = ex.get(row.id);
    if (!force && old?.status === "FINISHED" && old?.raw?.synced_final) continue;
    try { await processSummary(code, e, row); summaries++; } catch (err) { errors.push(e.id + ": " + String(err).slice(0, 300)); }
  }
  return { date, matches: evs.length, summaries, errors };
}

async function syncStandings(code: string) {
  const d = await getJSON(`${V2}${LEAGUES[code].espn}/standings`);
  const sbd = await getJSON(`${SITE}${LEAGUES[code].espn}/scoreboard`);
  const seasonId = await ensureSeason(code, sbd.leagues?.[0]?.season);
  const groups = d.children?.length ? d.children : [d];
  const teams: any[] = [], rows: any[] = [];
  for (const g of groups) {
    for (const e of g.standings?.entries || []) {
      const s = statMap(e.stats);
      teams.push({ ...e.team, logo: e.team.logos?.[0]?.href });
      rows.push({ competition_id: code, season_id: seasonId, team_id: String(e.team.id), position: s.rank ?? null,
        played: s.gamesPlayed ?? 0, won: s.wins ?? 0, drawn: s.ties ?? 0, lost: s.losses ?? 0,
        goals_for: s.pointsFor ?? 0, goals_against: s.pointsAgainst ?? 0, points: s.points ?? 0,
        note: e.note?.description ?? null, note_color: e.note?.color ?? null, group_name: groups.length > 1 ? g.name : null,
        updated_at: new Date().toISOString() });
    }
  }
  await upsertTeams(code, teams);
  if (rows.length) must(await sb.from("standings").upsert(rows, { onConflict: "competition_id,season_id,team_id" }), "standings");
  return rows.length;
}

async function calendar(code: string) {
  const sbd = await getJSON(`${SITE}${LEAGUES[code].espn}/scoreboard`);
  const L = sbd.leagues?.[0];
  const out = new Set<string>();
  for (const c of L?.calendar || []) {
    if (typeof c === "string") out.add(c.slice(0, 10).replace(/-/g, ""));
  }
  if (!out.size) {
    const start = new Date((L?.season?.startDate || "2026-08-01").slice(0, 10));
    const end = new Date((L?.season?.endDate || "2027-06-01").slice(0, 10));
    for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
      const dt = new Date(t); const wd = dt.getUTCDay();
      if ([2, 3, 4, 6].includes(wd)) out.add(dt.toISOString().slice(0, 10).replace(/-/g, ""));
    }
  }
  return [...out].sort();
}

function ymd(offset: number) {
  return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.secret !== SECRET) return new Response("forbidden", { status: 403 });
    const codes: string[] = body.league ? [body.league] : Object.keys(LEAGUES);
    const mode = body.mode || "recent";
    const out: any = {};
    for (const code of codes) {
      if (mode === "calendar") { out[code] = await calendar(code); continue; }
      if (mode === "standings") { out[code] = await syncStandings(code); continue; }
      let dates: string[] = body.dates || [];
      if (mode === "recent") dates = [ymd(-1), ymd(0)];
      if (mode === "window") { const f = body.from ?? -3, t = body.to ?? 14; for (let i = f; i <= t; i++) dates.push(ymd(i)); }
      const res = [];
      for (const dt of dates) res.push(await processDate(code, dt, !!body.force));
      out[code] = res;
      if (mode === "recent" || mode === "window" || body.standings) out[code + "_standings"] = await syncStandings(code);
    }
    return new Response(JSON.stringify({ ok: true, out }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
