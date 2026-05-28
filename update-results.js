// ═══════════════════════════════════════════════════════════════
//  update-results.js
//  סקריפט יומי — מושך תוצאות מ-football-data.org,
//  מעדכן את Supabase, ומחשב ניקוד לכל המשתמשים
//
//  הרצה ידנית:  node update-results.js
//  הרצה אוטומטית:  GitHub Actions (ראה .github/workflows)
//
//  משתני סביבה נדרשים (או עדכן ידנית למטה):
//    FOOTBALL_API_KEY      — מפתח חינמי מ-football-data.org
//    SUPABASE_URL          — כתובת הפרויקט
//    SUPABASE_ANON         — anon key (קריאה בלבד)
//    SUPABASE_SERVICE_ROLE — service role key (לעדכונים צד-שרת, עוקף RLS)
// ═══════════════════════════════════════════════════════════════

// ── הגדרות ─────────────────────────────────────────────────────
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || 'YOUR_FOOTBALL_DATA_API_KEY';
const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://zmhdhuvuegpjlcjhirnx.supabase.co';
const SUPABASE_ANON    = process.env.SUPABASE_ANON    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptaGRodXZ1ZWdwamxjamhpcm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NDU1MzUsImV4cCI6MjA5MzIyMTUzNX0.Jwn1g4_mlW4Z_tnzf0-DjQ63fn8U_LTgroCHd7iwRo0';
const SUPABASE_WRITE_KEY = process.env.SUPABASE_SERVICE_ROLE || SUPABASE_ANON;

// football-data.org: World Cup 2026 = competition code WC
const FD_BASE = 'https://api.football-data.org/v4';
const WC_CODE = 'WC';

// ── מיפוי שמות אנגלית → עברית (להתאמה עם DB) ─────────────────
const NAME_MAP = {
  'Mexico':              'מקסיקו',
  'South Africa':        'דרום אפריקה',
  'South Korea':         'דרום קוריאה',
  'Korea Republic':      'דרום קוריאה',
  'Canada':              'קנדה',
  'Qatar':               'קטאר',
  'Switzerland':         'שוויץ',
  'Brazil':              'ברזיל',
  'Morocco':             'מרוקו',
  'Haiti':               'האיטי',
  'Scotland':            'סקוטלנד',
  'USA':                 'ארה״ב',
  'United States':       'ארה״ב',
  'Paraguay':            'פרגוואי',
  'Australia':           'אוסטרליה',
  'Germany':             'גרמניה',
  'Curaçao':             'קוראסאו',
  'Curacao':             'קוראסאו',
  'Ivory Coast':         'חוף השנהב',
  "Côte d'Ivoire":       'חוף השנהב',
  'Ecuador':             'אקוודור',
  'Netherlands':         'הולנד',
  'Japan':               'יפן',
  'Tunisia':             'טוניסיה',
  'Belgium':             'בלגיה',
  'Egypt':               'מצרים',
  'Iran':                'איראן',
  'New Zealand':         'ניו זילנד',
  'Spain':               'ספרד',
  'Cape Verde':          'כף ורדה',
  'Saudi Arabia':        'ערב הסעודית',
  'Uruguay':             'אורוגוואי',
  'France':              'צרפת',
  'Senegal':             'סנגל',
  'Norway':              'נורווגיה',
  'Argentina':           'ארגנטינה',
  'Algeria':             'אלג׳יריה',
  'Austria':             'אוסטריה',
  'Jordan':              'ירדן',
  'Portugal':            'פורטוגל',
  'Uzbekistan':          'אוזבקיסטן',
  'Colombia':            'קולומביה',
  'England':             'אנגליה',
  'Croatia':             'קרואטיה',
  'Ghana':               'גאנה',
  'Panama':              'פנמה',
  'Czech Republic':      'צ׳כיה',
  'Czechia':             'צ׳כיה',
  'Bosnia and Herzegovina': 'בוסניה והרצגובינה',
  'Bosnia Herzegovina':  'בוסניה והרצגובינה',
  'Poland':              'פולין',
  'Serbia':              'סרביה',
  'Denmark':             'דנמרק',
  'Turkey':              'טורקיה',
  'Türkiye':             'טורקיה',
  'Wales':               'וויילס',
  'Sweden':              'שוודיה',
  'Ukraine':             'אוקראינה',
  'Romania':             'רומניה',
  'Slovenia':            'סלובניה',
  'Slovakia':            'סלובקיה',
  'Greece':              'יוון',
  'Hungary':             'הונגריה',
  'Iceland':             'איסלנד',
  'Cameroon':            'קמרון',
  'Nigeria':             'ניגריה',
  'DR Congo':            'קונגו',
  'Mali':                'מאלי',
  'Burkina Faso':        'בורקינה פאסו',
  'Tanzania':            'טנזניה',
  'China PR':            'סין',
  'China':               'סין',
  'Indonesia':           'אינדונזיה',
  'Iraq':                'עיראק',
  'Bahrain':             'בחריין',
  'Costa Rica':          'קוסטה ריקה',
  'Honduras':            'הונדורס',
  'Jamaica':             'ג׳מייקה',
  'El Salvador':         'אל סלבדור',
  'Trinidad and Tobago': 'טרינידד וטובגו',
  'Peru':                'פרו',
  'Chile':               'צ׳ילה',
  'Venezuela':           'ונצואלה',
  'Bolivia':             'בוליביה',
  // ── קבוצות פרמייר ליג (לבדיקת המערכת) ──
  'Arsenal FC':                  'ארסנל',
  'Arsenal':                     'ארסנל',
  'Aston Villa FC':              'אסטון וילה',
  'Aston Villa':                 'אסטון וילה',
  'AFC Bournemouth':             'בורנמות׳',
  'Bournemouth':                 'בורנמות׳',
  'Brentford FC':                'ברנטפורד',
  'Brentford':                   'ברנטפורד',
  'Brighton & Hove Albion FC':   'ברייטון',
  'Brighton':                    'ברייטון',
  'Chelsea FC':                  'צ׳לסי',
  'Chelsea':                     'צ׳לסי',
  'Crystal Palace FC':           'קריסטל פאלאס',
  'Crystal Palace':              'קריסטל פאלאס',
  'Everton FC':                  'אברטון',
  'Everton':                     'אברטון',
  'Fulham FC':                   'פולהאם',
  'Fulham':                      'פולהאם',
  'Ipswich Town FC':             'איפסוויץ׳',
  'Ipswich Town':                'איפסוויץ׳',
  'Leicester City FC':           'לסטר סיטי',
  'Leicester City':              'לסטר סיטי',
  'Liverpool FC':                'ליברפול',
  'Liverpool':                   'ליברפול',
  'Manchester City FC':          'מנצ׳סטר סיטי',
  'Manchester City':             'מנצ׳סטר סיטי',
  'Manchester United FC':        'מנצ׳סטר יונייטד',
  'Manchester United':           'מנצ׳סטר יונייטד',
  'Newcastle United FC':         'ניוקאסל',
  'Newcastle United':            'ניוקאסל',
  'Nottingham Forest FC':        'נוטינגהאם פורסט',
  'Nottingham Forest':           'נוטינגהאם פורסט',
  'Southampton FC':              'סאות׳המפטון',
  'Southampton':                 'סאות׳המפטון',
  'Tottenham Hotspur FC':        'טוטנהאם',
  'Tottenham Hotspur':           'טוטנהאם',
  'West Ham United FC':          'ווסט הם',
  'West Ham United':             'ווסט הם',
  'Wolverhampton Wanderers FC':  'וולברהמפטון',
  'Wolverhampton Wanderers':     'וולברהמפטון',
  'Sunderland AFC':              'סאנדרלנד',
  'Sunderland':                  'סאנדרלנד',
  'Burnley FC':                  'בורנלי',
  'Burnley':                     'בורנלי',
  'Leeds United FC':             'לידס יונייטד',
  'Leeds United':                'לידס יונייטד',
};

function toHeb(name) {
  return NAME_MAP[name] || name;
}

// ── Supabase helpers ─────────────────────────────────────────────
async function sbGet(table, query) {
  var url = SUPABASE_URL + '/rest/v1/' + table + '?' + query;
  var res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': 'Bearer ' + SUPABASE_ANON,
    }
  });
  if (!res.ok) throw new Error('sbGet ' + table + ': ' + res.status);
  return res.json();
}

async function sbPatch(table, query, body) {
  var url = SUPABASE_URL + '/rest/v1/' + table + '?' + query;
  var res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_WRITE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_WRITE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    var text = await res.text();
    throw new Error('sbPatch ' + table + ': ' + res.status + ' — ' + text);
  }
}

async function sbUpsert(table, body) {
  var url = SUPABASE_URL + '/rest/v1/' + table;
  var res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': 'Bearer ' + SUPABASE_ANON,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    var text = await res.text();
    throw new Error('sbUpsert ' + table + ': ' + res.status + ' — ' + text);
  }
}

// ── football-data.org API ────────────────────────────────────────
async function fetchMatches() {
  console.log('⚽ שולף תוצאות WC מ-football-data.org...');
  var url = FD_BASE + '/competitions/' + WC_CODE + '/matches?status=FINISHED';
  var res = await fetch(url, {
    headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
  });
  if (!res.ok) {
    var text = await res.text();
    throw new Error('football-data.org WC: ' + res.status + ' — ' + text);
  }
  var data = await res.json();
  return data.matches || [];
}

async function fetchPLMatches() {
  console.log('🏴󠁧󠁢󠁥󠁮󠁧󠁿 שולף תוצאות פרמייר ליג מ-football-data.org...');
  var url = FD_BASE + '/competitions/PL/matches?status=FINISHED&limit=30';
  var res = await fetch(url, {
    headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
  });
  if (!res.ok) {
    var text = await res.text();
    // PL דורש tier גבוה יותר באפשרות — נמשיך בלי שגיאה
    console.warn('   ⚠️  לא הצליח לשלוף PL: ' + res.status + ' — ' + text);
    return [];
  }
  var data = await res.json();
  return data.matches || [];
}

async function fetchCLMatches() {
  console.log('🏆 שולף תוצאות ליגת האלופות מ-football-data.org...');
  var url = FD_BASE + '/competitions/CL/matches?status=FINISHED&limit=30';
  var res = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } });
  if (!res.ok) {
    var text = await res.text();
    console.warn('   ⚠️  לא הצליח לשלוף CL: ' + res.status + ' — ' + text);
    return [];
  }
  var data = await res.json();
  return data.matches || [];
}

// ── שאלות סטטיסטיקה ──────────────────────────────────────────────
var STAT_TEMPLATES = [
  { stat: 'corners_total',         text: 'כמה קרנות יהיו בסך הכל?',                   tolerance: 1, pts: 25 },
  { stat: 'corners_home',          text: 'כמה קרנות תזכה {home}?',                     tolerance: 1, pts: 25 },
  { stat: 'corners_away',          text: 'כמה קרנות תזכה {away}?',                     tolerance: 1, pts: 25 },
  { stat: 'yellow_cards_total',    text: 'כמה כרטיסים צהובים יחולקו?',                tolerance: 1, pts: 30 },
  { stat: 'shots_on_target_total', text: 'כמה בעיטות על המסגרת יהיו (שתי הקבוצות)?', tolerance: 2, pts: 40 },
  { stat: 'fouls_total',           text: 'כמה חבלות יהיו בסך הכל?',                   tolerance: 2, pts: 35 },
  { stat: 'offsides_total',        text: 'כמה נסיעות עפים יהיו?',                      tolerance: 1, pts: 30 },
];

async function fetchMatchStats(apiMatchId) {
  var url = FD_BASE + '/matches/' + apiMatchId;
  var res = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } });
  if (!res.ok) {
    console.warn('   ⚠️  לא הצליח לשלוף stats ל-' + apiMatchId + ': ' + res.status);
    return null;
  }
  return await res.json();
}

function extractStats(data) {
  var stats = {};
  if (data.statistics) {
    data.statistics.forEach(function(s) {
      if (s.type === 'CORNER_KICKS')          { stats.corners_home = s.home; stats.corners_away = s.away; stats.corners_total = s.home + s.away; }
      if (s.type === 'SHOTS_ON_GOAL')         { stats.shots_on_target_total = s.home + s.away; }
      if (s.type === 'TOTAL_FOUL_COMMITTED')  { stats.fouls_total = s.home + s.away; }
      if (s.type === 'OFFSIDES')              { stats.offsides_total = (s.home || 0) + (s.away || 0); }
    });
  }
  if (data.bookings) {
    stats.yellow_cards_total = data.bookings.filter(function(b) { return b.card === 'YELLOW_CARD'; }).length;
  }
  return stats;
}

async function createPlaceholderQuestions(match) {
  var existCheck = await sbGet('questions', 'match_id=eq.' + match.id + '&type=eq.numeric');
  if (existCheck.length > 0) return;

  var date = match.match_date.split('T')[0];
  var pool = STAT_TEMPLATES.slice();
  pool.sort(function() { return Math.random() - 0.5; });
  var chosen = pool.slice(0, 3);

  for (var i = 0; i < chosen.length; i++) {
    var tmpl = chosen[i];
    var text = tmpl.text
      .replace('{home}', match.home_team)
      .replace('{away}', match.away_team);
    var row = {
      text:          text,
      options:       JSON.stringify([]),
      correct:       null,
      points:        tmpl.pts,
      question_date: date,
      active:        true,
      match_id:      match.id,
      type:          'numeric',
      tolerance:     tmpl.tolerance,
      stat_key:      tmpl.stat,
    };
    await sbUpsert('questions', row);
    console.log('   ❓ ' + text + ' [' + tmpl.stat + ']');
  }
}

async function updateQuestionsCorrectAnswer(matchId, stats) {
  var questions = await sbGet('questions', 'match_id=eq.' + matchId + '&type=eq.numeric&correct=is.null');
  if (questions.length === 0) return;

  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    var val = stats[q.stat_key];
    if (val === undefined || val === null) {
      console.log('   ⏭️  אין נתון עבור ' + q.stat_key);
      continue;
    }
    await sbPatch('questions', 'id=eq.' + q.id, { correct: String(val) });
    console.log('   ✅ שאלה ' + q.id + ' (' + q.stat_key + ') → ' + val);
  }
}

// ── חישוב ניקוד (זהה ל-clientCalcPts באתר) ──────────────────────
var BASE_PTS   = { exact_90:100, result_90:50, exact_et:150, result_et:80, exact_pen:200, winner_pen:100 };
var STAGE_MULT = { GROUP_STAGE:1, LAST_32:1.5, LAST_16:2, QUARTER_FINALS:3, SEMI_FINALS:4, THIRD_PLACE:4, FINAL:5 };
// מיפוי מ-football-data stage names ל-DB stage names
var STAGE_DB   = { GROUP_STAGE:'GROUP', LAST_32:'R32', LAST_16:'R16', QUARTER_FINALS:'QF', SEMI_FINALS:'SF', THIRD_PLACE:'THIRD', FINAL:'FINAL' };
var TOURNAMENT_START = new Date('2026-06-11T00:00:00Z');

function calcPoints(pred, result, resultET, resultPen, stage) {
  if (!result || !pred) return 0;
  var mult  = STAGE_MULT[stage] || 1;
  var early = pred.saved_at && new Date(pred.saved_at) < TOURNAMENT_START;
  var bonus = early ? 1.5 : 1;
  var raw = 0;

  var ph = +pred.h, pa = +pred.a;
  var rh = result.h, ra = result.a;

  if (ph === rh && pa === ra)                          raw += BASE_PTS.exact_90;
  else if (Math.sign(ph - pa) === Math.sign(rh - ra)) raw += BASE_PTS.result_90;

  if (pred.et_h !== undefined && resultET) {
    var peh = +pred.et_h, pea = +pred.et_a;
    var reh = resultET.h,  rea = resultET.a;
    if (peh === reh && pea === rea)                          raw += BASE_PTS.exact_et;
    else if (Math.sign(peh - pea) === Math.sign(reh - rea)) raw += BASE_PTS.result_et;
  }

  if (pred.pen_h !== undefined && resultPen) {
    var pph = +pred.pen_h, ppa = +pred.pen_a;
    var rph = resultPen.h,  rpa = resultPen.a;
    if (pph === rph && ppa === rpa)                          raw += BASE_PTS.exact_pen;
    else if (Math.sign(pph - ppa) === Math.sign(rph - rpa)) raw += BASE_PTS.winner_pen;
  }

  return Math.round(raw * mult * bonus);
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  if (FOOTBALL_API_KEY === 'YOUR_FOOTBALL_DATA_API_KEY') {
    console.error('❌ חסר API key — הגדר FOOTBALL_API_KEY');
    console.log('   הירשם בחינם: https://www.football-data.org/client/register');
    process.exit(1);
  }

  // ──────────────────────────────────────────────────
  // שלב 1: שלוף תוצאות מ-API (WC + PL + CL)
  // ──────────────────────────────────────────────────
  var results = await Promise.all([fetchMatches(), fetchPLMatches(), fetchCLMatches()]);
  var apiMatches = results[0].concat(results[1]).concat(results[2]);
  console.log('📦 נמצאו ' + apiMatches.length + ' משחקים שהסתיימו (WC + PL + CL)');

  if (apiMatches.length === 0) {
    console.log('ℹ️  אין משחקים שהסתיימו עדיין — יוצא.');
    return;
  }

  // ──────────────────────────────────────────────────
  // שלב 2: שלוף את כל המשחקים מ-Supabase
  // ──────────────────────────────────────────────────
  var dbMatches = await sbGet('matches', 'select=*&order=match_date.asc');
  console.log('📊 ' + dbMatches.length + ' משחקים ב-Supabase');

  // ──────────────────────────────────────────────────
  // שלב 3: התאם ועדכן תוצאות
  // ──────────────────────────────────────────────────
  var updated = 0;

  for (var i = 0; i < apiMatches.length; i++) {
    var am = apiMatches[i];
    var homeHe = toHeb(am.homeTeam.name);
    var awayHe = toHeb(am.awayTeam.name);

    // מצא את המשחק המתאים ב-DB לפי קבוצות ותאריך
    var dbMatch = dbMatches.find(function(dm) {
      return dm.home_team === homeHe && dm.away_team === awayHe;
    });

    // אם לא מצאנו לפי שם מדויק, נסה לפי תאריך + שם חלקי
    if (!dbMatch) {
      var apiDate = am.utcDate.split('T')[0];
      dbMatch = dbMatches.find(function(dm) {
        var dbDate = dm.match_date.split('T')[0];
        return dbDate === apiDate &&
          (dm.home_team.includes(homeHe) || homeHe.includes(dm.home_team)) &&
          (dm.away_team.includes(awayHe) || awayHe.includes(dm.away_team));
      });
    }

    if (!dbMatch) {
      console.log('   ⚠️  לא נמצא ב-DB: ' + am.homeTeam.name + ' vs ' + am.awayTeam.name);
      continue;
    }

    // אם כבר עודכן — דלג
    if (dbMatch.home_score !== null) continue;

    // חלץ תוצאות
    var ft = am.score.fullTime;
    var ht = am.score.halfTime;
    var dur = am.score.duration; // REGULAR, EXTRA_TIME, PENALTY_SHOOTOUT

    var patch = {
      home_score: ft.home,
      away_score: ft.away,
      status: 'FINISHED',
    };

    // הארכה
    if (dur === 'EXTRA_TIME' || dur === 'PENALTY_SHOOTOUT') {
      // regularTime = תוצאת 90 דקות
      if (am.score.regularTime) {
        patch.home_score = am.score.regularTime.home;
        patch.away_score = am.score.regularTime.away;
      }
      patch.home_score_et = ft.home;
      patch.away_score_et = ft.away;
      patch.has_extra_time = true;
    }

    // פנדלים
    if (dur === 'PENALTY_SHOOTOUT' && am.score.penalties) {
      patch.home_score_pen = am.score.penalties.home;
      patch.away_score_pen = am.score.penalties.away;
    }

    // עדכן ב-Supabase
    await sbPatch('matches', 'id=eq.' + dbMatch.id, patch);
    updated++;
    console.log('   ✅ ' + dbMatch.home_team + ' ' + patch.home_score + '–' + patch.away_score + ' ' + dbMatch.away_team +
      (patch.home_score_et !== undefined ? ' (הארכה: ' + patch.home_score_et + '–' + patch.away_score_et + ')' : '') +
      (patch.home_score_pen !== undefined ? ' (פנד: ' + patch.home_score_pen + '–' + patch.away_score_pen + ')' : ''));
  }

  console.log('\n📝 עודכנו ' + updated + ' תוצאות חדשות');

  // ──────────────────────────────────────────────────
  // שלב 4א: צור שאלות placeholder לכל משחק עתידי קרוב
  // ──────────────────────────────────────────────────
  console.log('\n❓ בודק שאלות לפני משחקים קרובים...');
  var dbMatchesAll = await sbGet('matches', 'select=*&order=match_date.asc');
  var now = new Date();
  var twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  var upcoming = dbMatchesAll.filter(function(m) {
    if (m.home_score !== null) return false;
    var d = new Date(m.match_date);
    return d > now && (d - now) < twoDaysMs;
  });
  for (var qi = 0; qi < upcoming.length; qi++) {
    await createPlaceholderQuestions(upcoming[qi]);
  }
  if (upcoming.length === 0) console.log('   (אין משחקים קרובים ב-48 שעות הקרובות)');

  // ──────────────────────────────────────────────────
  // שלב 4ב: עדכן תשובות נכונות לשאלות של משחקים שהסתיימו
  // ──────────────────────────────────────────────────
  if (updated > 0) {
    console.log('\n📊 מעדכן תשובות לשאלות סטטיסטיקה...');
    var updatedMatchIds = [];
    for (var i2 = 0; i2 < apiMatches.length; i2++) {
      var am2 = apiMatches[i2];
      var homeHe2 = toHeb(am2.homeTeam.name);
      var awayHe2 = toHeb(am2.awayTeam.name);
      var dm2 = dbMatchesAll.find(function(dm) { return dm.home_team === homeHe2 && dm.away_team === awayHe2; });
      if (dm2 && dm2.home_score !== null) continue; // כבר היה מעודכן
      if (dm2) updatedMatchIds.push({ dbId: dm2.id, apiId: am2.id });
    }
    for (var si = 0; si < updatedMatchIds.length; si++) {
      var matchData = await fetchMatchStats(updatedMatchIds[si].apiId);
      if (!matchData) continue;
      var stats = extractStats(matchData);
      await updateQuestionsCorrectAnswer(updatedMatchIds[si].dbId, stats);
    }
  }

  // ──────────────────────────────────────────────────
  // שלב 5: חשב מחדש ניקוד לכל המשתמשים
  // ──────────────────────────────────────────────────
  if (updated === 0) {
    console.log('\n🎉 סיום! אין תוצאות חדשות לחישוב ניקוד.');
    return;
  }

  console.log('\n🔄 מחשב ניקוד מחדש...');

  // טען מחדש את המשחקים (כולל העדכונים)
  var allMatches = await sbGet('matches', 'select=*');

  // טען את כל השאלות (לחישוב tolerance)
  var allQuestions = await sbGet('questions', 'select=id,type,tolerance,correct,points');

  // טען את כל המשתמשים
  var allUsers = await sbGet('user_data', 'select=*');
  console.log('👥 ' + allUsers.length + ' משתמשים');

  for (var u = 0; u < allUsers.length; u++) {
    var user = allUsers[u];
    var predictions = user.predictions || {};
    var answers     = user.answers     || {};
    var totalScore  = 0;

    // ניקוד ממשחקים
    var matchIds = Object.keys(predictions);
    for (var mi = 0; mi < matchIds.length; mi++) {
      var matchId = matchIds[mi];
      var pred = predictions[matchId];
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });

      if (!match || match.home_score === null) continue;

      var result    = { h: match.home_score, a: match.away_score };
      var resultET  = match.home_score_et  !== null ? { h: match.home_score_et,  a: match.away_score_et  } : null;
      var resultPen = match.home_score_pen !== null ? { h: match.home_score_pen, a: match.away_score_pen } : null;

      // מצא את stage של ה-API (או השתמש ב-DB stage)
      var fdStage = 'GROUP_STAGE';
      if (match.stage === 'R32')    fdStage = 'LAST_32';
      if (match.stage === 'R16')    fdStage = 'LAST_16';
      if (match.stage === 'QF')     fdStage = 'QUARTER_FINALS';
      if (match.stage === 'SF')     fdStage = 'SEMI_FINALS';
      if (match.stage === 'THIRD')  fdStage = 'THIRD_PLACE';
      if (match.stage === 'FINAL')  fdStage = 'FINAL';

      var pts = calcPoints(pred, result, resultET, resultPen, fdStage);
      totalScore += pts;
    }

    // ניקוד משאלות (כולל tolerance לשאלות נומריות)
    var answerKeys = Object.keys(answers);
    for (var ai = 0; ai < answerKeys.length; ai++) {
      var ak = answerKeys[ai];
      var ans = answers[ak];
      if (!ans || !ans.pts) continue;
      var qRow = allQuestions.find(function(q) { return String(q.id) === ak; });
      var qCorrect;
      if (qRow && qRow.type === 'numeric' && qRow.correct !== null) {
        qCorrect = Math.abs(+ans.sel - +qRow.correct) <= (qRow.tolerance || 0);
      } else {
        qCorrect = !!ans.correct;
      }
      if (qCorrect) totalScore += ans.pts;
    }

    // ניקוד מהימור אלוף (נבדק רק בסוף הטורניר — כאן שומרים אותו כצפי)
    // TODO: בסוף הטורניר, בדוק אם champBet.teamId === הזוכה

    // עדכן
    if (user.score !== totalScore) {
      await sbPatch('user_data', 'id=eq.' + user.id, { score: totalScore });
      console.log('   📊 ' + user.id.substring(0, 8) + '... → ' + totalScore + ' נק\' (היה ' + (user.score || 0) + ')');
    }
  }

  console.log('\n🎉 סיום! הכל מעודכן.');
}

// ═══════════════════════════════════════════════════════════════
main().catch(function(err) {
  console.error('❌ שגיאה:', err.message);
  process.exit(1);
});