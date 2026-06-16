// ═══════════════════════════════════════════════════════════════
//  recalc.js
//  מחשב מחדש את הניקוד של כל המשתמשים — מטבלת matches בלבד.
//  לא נוגע ב-football API, ולכן עובד גם על תוצאות שהוזנו ידנית
//  ועל משחקי בדיקה שאינם קיימים ב-API.
//
//  הרצה:
//    SUPABASE_SERVICE_ROLE=eyJ... node recalc.js
//
//  חובה SERVICE_ROLE — נדרש כדי לקרוא את כל המשתמשים ולעדכן ניקוד
//  (anon ייחסם ע"י RLS).
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zmhdhuvuegpjlcjhirnx.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE;

if (!KEY) {
  console.error('❌ חסר SUPABASE_SERVICE_ROLE — הרץ:  SUPABASE_SERVICE_ROLE=xxx node recalc.js');
  process.exit(1);
}

// ── Supabase REST helpers (קריאה + כתיבה עם service role) ──────
async function sbGet(table, query) {
  const url = SUPABASE_URL + '/rest/v1/' + table + '?' + query;
  const res = await fetch(url, {
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
  });
  if (!res.ok) throw new Error('sbGet ' + table + ': ' + res.status + ' — ' + (await res.text()));
  return res.json();
}

async function sbPatch(table, query, body) {
  const url = SUPABASE_URL + '/rest/v1/' + table + '?' + query;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('sbPatch ' + table + ': ' + res.status + ' — ' + (await res.text()));
}

// ── חישוב ניקוד — זהה ל-update-results.js ול-clientCalcPts ─────
const BASE_PTS   = { exact_90: 100, result_90: 50, exact_et: 150, result_et: 80, exact_pen: 200, winner_pen: 100 };
const STAGE_MULT = { GROUP_STAGE: 1, LAST_32: 1.5, LAST_16: 2, QUARTER_FINALS: 3, SEMI_FINALS: 4, THIRD_PLACE: 4, FINAL: 5 };

function calcPoints(pred, result, resultET, resultPen, stage) {
  if (!result || !pred) return 0;
  const mult = STAGE_MULT[stage] || 1;
  let raw = 0;

  const ph = +pred.h, pa = +pred.a;
  const rh = result.h, ra = result.a;

  if (ph === rh && pa === ra)                          raw += BASE_PTS.exact_90;
  else if (Math.sign(ph - pa) === Math.sign(rh - ra)) raw += BASE_PTS.result_90;

  if (pred.et_h !== undefined && resultET) {
    const peh = +pred.et_h, pea = +pred.et_a;
    if (peh === resultET.h && pea === resultET.a)                          raw += BASE_PTS.exact_et;
    else if (Math.sign(peh - pea) === Math.sign(resultET.h - resultET.a)) raw += BASE_PTS.result_et;
  }

  if (pred.pen_h !== undefined && resultPen) {
    const pph = +pred.pen_h, ppa = +pred.pen_a;
    if (pph === resultPen.h && ppa === resultPen.a)                          raw += BASE_PTS.exact_pen;
    else if (Math.sign(pph - ppa) === Math.sign(resultPen.h - resultPen.a)) raw += BASE_PTS.winner_pen;
  }

  return Math.round(raw * mult);
}

function stageToFd(stage) {
  switch (stage) {
    case 'R32':   return 'LAST_32';
    case 'R16':   return 'LAST_16';
    case 'QF':    return 'QUARTER_FINALS';
    case 'SF':    return 'SEMI_FINALS';
    case 'THIRD': return 'THIRD_PLACE';
    case 'FINAL': return 'FINAL';
    default:      return 'GROUP_STAGE';
  }
}

// ═══════════════════════════════════════════════════════════════
(async function main() {
  const allMatches = await sbGet('matches', 'select=*');
  const allUsers   = await sbGet('user_data', 'select=*');
  console.log('📊 ' + allMatches.length + ' משחקים · 👥 ' + allUsers.length + ' משתמשים');

  if (allUsers.length === 0) {
    console.error('⚠️  0 משתמשים — כנראה ה-SERVICE_ROLE שגוי או ש-RLS חוסם. בדוק את המפתח.');
    process.exit(1);
  }

  const byId = {};
  allMatches.forEach(function (m) { byId[String(m.id)] = m; });

  let changed = 0;

  for (const user of allUsers) {
    const predictions = user.predictions || {};
    let totalScore = 0;

    for (const matchId of Object.keys(predictions)) {
      const pred  = predictions[matchId];
      const match = byId[String(matchId)];
      if (!match || match.home_score === null) continue;

      const result    = { h: match.home_score, a: match.away_score };
      const resultET  = match.home_score_et  !== null && match.home_score_et  !== undefined ? { h: match.home_score_et,  a: match.away_score_et  } : null;
      const resultPen = match.home_score_pen !== null && match.home_score_pen !== undefined ? { h: match.home_score_pen, a: match.away_score_pen } : null;

      totalScore += calcPoints(pred, result, resultET, resultPen, stageToFd(match.stage));
    }

    if (user.score !== totalScore) {
      await sbPatch('user_data', 'id=eq.' + user.id, { score: totalScore });
      console.log('   📊 ' + String(user.id).substring(0, 8) + '... → ' + totalScore + ' נק\' (היה ' + (user.score || 0) + ')');
      changed++;
    }
  }

  console.log('\n🎉 סיום! עודכנו ' + changed + ' משתמשים.');
})().catch(function (err) {
  console.error('❌ שגיאה:', err.message);
  process.exit(1);
});
