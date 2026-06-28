// sync.js - Mundial 2026 Sync  (API-Football v3)
// ------------------------------------------------------
// npm install @supabase/supabase-js node-fetch dotenv
// node sync.js
//
// cron (כל 5 דקות בזמן הטורניר):
//   */5 * * * * node /path/to/sync.js >> /var/log/m26.log 2>&1
// ------------------------------------------------------

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// ── .env ──────────────────────────────────────────────
// SUPABASE_URL=https://xxx.supabase.co
// SUPABASE_SERVICE_KEY=eyJ...   (service_role, NOT anon)
// API_FOOTBALL_KEY=xxxx         (api-sports.io dashboard)

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const API_KEY          = process.env.API_FOOTBALL_KEY;
const WC_LEAGUE_ID     = 1;       // World Cup league ID in API-Football
const WC_SEASON        = 2026;
const LOCK_MIN         = 60;      // נעילה כמה דקות לפני קיקאוף

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE);

// SCORING SYSTEM
// ניקוד בסיסי x מכפיל שלב x בונוס ניחוש מוקדם
//
// מכפיל שלב: GROUP x1 / R16 x2 / QF x3 / SF x4 / FINAL x5
// בונוס ניחוש מוקדם (לפני פתיחת הטורניר): x1.5
//
// דוגמאות:
//   תוצאה מדויקת בגמר:          10 x 5       = 50 נק'
//   + ניחוש מוקדם:               50 x 1.5     = 75 נק'
//   הארכה מדויקת + ניחוש מוקדם: 15 x 5 x 1.5 = 112.5 -> 113 נק'
//   פנדלים מדויק + ניחוש מוקדם: 20 x 5 x 1.5 = 150 נק'

const BASE = {
  exact_90:   100,
  result_90:  50,
  exact_et:   150,
  result_et:  80,
  exact_pen:  200,
  winner_pen: 100,
};

const STAGE_MULT = {
  GROUP: 1,
  R32:   2,
  R16:   2,
  QF:    3,
  SF:    4,
  THIRD: 4,
  FINAL: 5,
};

const EARLY_BONUS = 1.5;

// תאריך פתיחת הטורניר — ניחוש לפני תאריך זה = "ניחוש מוקדם"
const TOURNAMENT_START = new Date('2026-06-11T00:00:00Z');

// ── FLAG MAP ───────────────────────────────────────────
const FLAGS = {
  'Argentina':'🇦🇷','Brazil':'🇧🇷','Spain':'🇪🇸','Germany':'🇩🇪',
  'France':'🇫🇷','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Portugal':'🇵🇹','Netherlands':'🇳🇱',
  'Morocco':'🇲🇦','Japan':'🇯🇵','Mexico':'🇲🇽','Poland':'🇵🇱',
  'USA':'🇺🇸','United States':'🇺🇸','Canada':'🇨🇦','Senegal':'🇸🇳',
  'Uruguay':'🇺🇾','Croatia':'🇭🇷','Belgium':'🇧🇪','Denmark':'🇩🇰',
  'Switzerland':'🇨🇭','Australia':'🇦🇺','South Korea':'🇰🇷',
  'Saudi Arabia':'🇸🇦','Ecuador':'🇪🇨','Qatar':'🇶🇦','Serbia':'🇷🇸',
  'Tunisia':'🇹🇳','Cameroon':'🇨🇲','Ghana':'🇬🇭','Iran':'🇮🇷',
  'Costa Rica':'🇨🇷','Wales':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','Slovakia':'🇸🇰','Slovenia':'🇸🇮',
};
const flag = n => FLAGS[n] || '🏳️';

// שלבי נוקאאוט שבהם מותרת הארכה
const KNOCKOUT_STAGES = new Set(['R32','R16','QF','SF','FINAL','THIRD']);

// ── API-Football helper ────────────────────────────────
async function apiFetch(endpoint) {
  const url = `https://v3.football.api-sports.io/${endpoint}`;
  const res  = await fetch(url, {
    headers: { 'x-apisports-key': API_KEY },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length)
    throw new Error(JSON.stringify(json.errors));
  return json.response;
}

// ── STAGE MAP ──────────────────────────────────────────
const STAGE_MAP = {
  'Group Stage':       'GROUP',
  'Round of 32':       'R32',
  'Round of 16':       'R16',
  'Quarter-finals':    'QF',
  'Semi-finals':       'SF',
  'Final':             'FINAL',
  '3rd Place Final':   'THIRD',
};

// ══════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════
async function main() {
  console.log('[sync] start', new Date().toISOString());
  try {
    await syncFixtures();
    await syncLiveAndFinished();
    await scoreAllUsers();
    await generateQuestions();
  } catch (e) {
    console.error('[sync] fatal:', e.message);
  }
  console.log('[sync] done');
}

// ══════════════════════════════════════════════════════
//  1. FIXTURES  — שולף את כל לוח המשחקים
// ══════════════════════════════════════════════════════
async function syncFixtures() {
  console.log('[1] fixtures...');
  const fixtures = await apiFetch(
    `fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`
  );
  console.log(`    ${fixtures.length} fixtures from API`);

  for (const f of fixtures) {
    const { fixture, teams, goals, score, league } = f;
    const stage   = STAGE_MAP[league.round] || league.round;
    const isKO    = KNOCKOUT_STAGES.has(stage);
    const matchDate = new Date(fixture.date);
    const lockTime  = new Date(matchDate.getTime() - LOCK_MIN * 60_000);

    const row = {
      api_id:         String(fixture.id),
      match_date:     matchDate.toISOString(),
      lock_time:      lockTime.toISOString(),
      group_name:     league.round,
      stage,
      home_team:      teams.home.name,
      away_team:      teams.away.name,
      home_flag:      flag(teams.home.name),
      away_flag:      flag(teams.away.name),
      has_extra_time: isKO,
      status:         fixture.status.short,       // NS / 1H / HT / 2H / ET / P / FT / AET / PEN
      // תוצאות (null אם טרם שוחק)
      home_score:     goals.home,
      away_score:     goals.away,
      home_score_et:  score.extratime?.home ?? null,
      away_score_et:  score.extratime?.away ?? null,
      home_score_pen: score.penalty?.home   ?? null,
      away_score_pen: score.penalty?.away   ?? null,
    };

    const { error } = await sb.from('matches').upsert(row, { onConflict: 'api_id' });
    if (error) console.error('    upsert', fixture.id, error.message);
  }
  console.log('    fixtures done');
}

// ══════════════════════════════════════════════════════
//  2. LIVE + FINISHED  — עדכון סטטוס + סטטיסטיקות
//     רץ כל 5 דקות בזמן משחקים
// ══════════════════════════════════════════════════════
async function syncLiveAndFinished() {
  console.log('[2] live/finished...');

  // שלוף משחקים חיים
  let live = [];
  try { live = await apiFetch(`fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&live=all`); }
  catch(e) { console.warn('    no live data:', e.message); }

  // שלוף משחקים שנסיימו היום (לסטטיסטיקות)
  const todayStr = new Date().toISOString().split('T')[0];
  let todayFin = [];
  try {
    todayFin = await apiFetch(
      `fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&date=${todayStr}&status=FT-AET-PEN`
    );
  } catch(e) { console.warn('    no today finished:', e.message); }

  const toProcess = [...live, ...todayFin];
  if (!toProcess.length) { console.log('    nothing live/finished'); return; }

  for (const f of toProcess) {
    const { fixture, goals, score } = f;
    const row = {
      status:         fixture.status.short,
      home_score:     goals.home,
      away_score:     goals.away,
      home_score_et:  score.extratime?.home ?? null,
      away_score_et:  score.extratime?.away ?? null,
      home_score_pen: score.penalty?.home   ?? null,
      away_score_pen: score.penalty?.away   ?? null,
    };

    const { error } = await sb.from('matches')
      .update(row)
      .eq('api_id', String(fixture.id));
    if (error) console.error('    update', fixture.id, error.message);

    // שמור סטטיסטיקות אם המשחק נסיים
    if (['FT','AET','PEN'].includes(fixture.status.short)) {
      await syncStats(fixture.id);
    }
  }
  console.log('    live/finished done');
}

// שולף סטטיסטיקות מפורטות למשחק ומאחסן ב-questions
async function syncStats(apiFixtureId) {
  let stats = [];
  try { stats = await apiFetch(`fixtures/statistics?fixture=${apiFixtureId}`); }
  catch(e) { return; }

  // שמור סטטיסטיקות גולמיות ב-matches.stats (JSONB — נוסיף עמודה)
  // ממיר מערך לאובייקט { "Ball Possession": { home:"55%", away:"45%" }, ... }
  const statMap = {};
  for (const teamStat of stats) {
    const side = teamStat.team.id === stats[0].team.id ? 'home' : 'away';
    for (const s of teamStat.statistics) {
      if (!statMap[s.type]) statMap[s.type] = {};
      statMap[s.type][side] = s.value;
    }
  }

  // עדכן ב-matches
  const { data: match } = await sb.from('matches')
    .select('id')
    .eq('api_id', String(apiFixtureId))
    .single();
  if (!match) return;

  // הוסף עמודת stats אם עדיין לא קיימת (נעשה ב-SQL — ראה הערה בסוף)
  await sb.from('matches').update({ stats: statMap }).eq('id', match.id);
}

// ══════════════════════════════════════════════════════
//  3. SCORE USERS  — מחשב ניקוד לכל המשתמשים
// ══════════════════════════════════════════════════════
async function scoreAllUsers() {
  console.log('[3] scoring...');

  // כל המשחקים שנסיימו
  const { data: finished } = await sb
    .from('matches')
    .select('*')
    .in('status', ['FT', 'AET', 'PEN']);

  if (!finished?.length) { console.log('    no finished matches'); return; }

  const { data: users } = await sb
    .from('user_data')
    .select('id, score, predictions');

  let totalUpdates = 0;

  for (const user of users || []) {
    let earned = 0;
    const preds = { ...(user.predictions || {}) };

    for (const match of finished) {
      const mid  = String(match.id);
      const pred = preds[mid];
      if (!pred || pred.scored) continue;

      const pts = calcAllPoints(pred, match);
      preds[mid] = { ...pred, scored: true, pts };
      earned += pts;

      if (pts) console.log(`    +${pts} user=${user.id} match=${mid}`);
    }

    if (earned > 0 || Object.keys(preds).some(k => preds[k].scored && !user.predictions?.[k]?.scored)) {
      await sb.from('user_data').update({
        score:       (user.score || 0) + earned,
        predictions: preds,
      }).eq('id', user.id);
      totalUpdates++;
    }
  }
  console.log(`    scoring done (${totalUpdates} users updated)`);
}

// ── חישוב ניקוד מלא לניחוש אחד ──────────────────────
// pred.saved_at  = ISO timestamp של שמירת הניחוש (נשמר ב-savePred)
// match.stage    = GROUP / R16 / QF / SF / FINAL
function calcAllPoints(pred, match) {
  const mult  = STAGE_MULT[match.stage] ?? 1;
  const early = pred.saved_at && new Date(pred.saved_at) < TOURNAMENT_START;
  const bonus = early ? EARLY_BONUS : 1;

  let raw = 0;

  // 90 דקות
  const ph = +pred.h, pa = +pred.a;
  const rh = match.home_score ?? 0, ra = match.away_score ?? 0;
  if (ph === rh && pa === ra)                              raw += BASE.exact_90;
  else if (Math.sign(ph - pa) === Math.sign(rh - ra))     raw += BASE.result_90;

  // הארכה
  if (pred.et_h !== undefined && match.home_score_et !== null) {
    const peh = +pred.et_h, pea = +pred.et_a;
    const reh = match.home_score_et, rea = match.away_score_et;
    if (peh === reh && pea === rea)                        raw += BASE.exact_et;
    else if (Math.sign(peh - pea) === Math.sign(reh - rea)) raw += BASE.result_et;
  }

  // פנדלים
  if (pred.pen_h !== undefined && match.home_score_pen !== null) {
    const pph = +pred.pen_h, ppa = +pred.pen_a;
    const rph = match.home_score_pen, rpa = match.away_score_pen;
    if (pph === rph && ppa === rpa)                        raw += BASE.exact_pen;
    else if (Math.sign(pph - ppa) === Math.sign(rph - rpa)) raw += BASE.winner_pen;
  }

  // החל מכפיל שלב + בונוס ניחוש מוקדם, עגל לשלם
  return Math.round(raw * mult * bonus);
}

// ══════════════════════════════════════════════════════
//  4. GENERATE QUESTIONS
//     נוצרות עם correct=null — ממולאות אוטו מסטטיסטיקות
// ══════════════════════════════════════════════════════
async function generateQuestions() {
  console.log('[4] questions...');

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  const { data: matches } = await sb
    .from('matches')
    .select('*')
    .in('status', ['FT', 'AET', 'PEN'])
    .gte('match_date', todayStart.toISOString())
    .lt('match_date', todayEnd.toISOString());

  if (!matches?.length) { console.log('    no matches to question'); return; }

  const tomorrow = new Date(todayStart.getTime() + 86_400_000)
    .toISOString().split('T')[0];

  for (const m of matches) {
    const { data: ex } = await sb.from('questions')
      .select('id').eq('match_id', m.id).eq('question_date', tomorrow);
    if (ex?.length) continue;

    const stats  = m.stats || {};
    const homePoss = stats['Ball Possession']?.home ?? null;
    const awayCorn = stats['Corner Kicks']?.away    ?? null;

    // 3 שאלות — התשובה הנכונה נשלפת מהסטטיסטיקות אם זמינות
    const qs = [
      {
        text:    `כמה שערים סה"כ במשחק ${m.home_team} – ${m.away_team}?`,
        options: ['0–1', '2–3', '4–5', '6+'],
        correct: autoGoalsRange(m.home_score + m.away_score),
        points:  4,
      },
      {
        text:    `אחוז החזקת כדור של ${m.home_team}?`,
        options: ['מתחת ל-40%', '40–50%', '51–60%', 'מעל 60%'],
        correct: homePoss ? autoPossRange(homePoss) : null,
        points:  5,
      },
      {
        text:    `כמה קרנות ל-${m.away_team}?`,
        options: ['0–2', '3–5', '6–8', '9+'],
        correct: awayCorn !== null ? autoCornRange(+awayCorn) : null,
        points:  3,
      },
    ];

    for (const q of qs) {
      const { error } = await sb.from('questions').insert({
        match_id:      m.id,
        question_date: tomorrow,
        text:          q.text,
        options:       q.options,
        correct:       q.correct,   // null = תמלא ידנית ב-Dashboard
        points:        q.points,
        active:        true,
      });
      if (error) console.error('    q insert:', error.message);
    }
    console.log(`    questions for match ${m.id} (${m.home_team} vs ${m.away_team})`);
  }
}

// ── auto-range helpers ─────────────────────────────────
function autoGoalsRange(n) {
  if (n <= 1) return '0–1';
  if (n <= 3) return '2–3';
  if (n <= 5) return '4–5';
  return '6+';
}
function autoPossRange(s) {
  // s = "55%" or 55
  const n = parseFloat(s);
  if (n < 40) return 'מתחת ל-40%';
  if (n <= 50) return '40–50%';
  if (n <= 60) return '51–60%';
  return 'מעל 60%';
}
function autoCornRange(n) {
  if (n <= 2) return '0–2';
  if (n <= 5) return '3–5';
  if (n <= 8) return '6–8';
  return '9+';
}

// ══════════════════════════════════════════════════════
main().catch(console.error);

/*
  הוסף עמודת stats ל-matches לאחר הרצת ה-SQL הראשי:
  ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS stats jsonb default '{}';
*/
