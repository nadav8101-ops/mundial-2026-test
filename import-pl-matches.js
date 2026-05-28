// ═══════════════════════════════════════════════════════════════
//  import-pl-matches.js
//  מייבא משחקי פרמייר ליג קרובים מ-football-data.org ל-Supabase
//  לצורך בדיקת המערכת לפני המונדיאל
//
//  הרצה:  node import-pl-matches.js
//
//  משתני סביבה (או ערוך ידנית למטה):
//    FOOTBALL_API_KEY  — מפתח חינמי מ-football-data.org
//    SUPABASE_URL
//    SUPABASE_ANON
// ═══════════════════════════════════════════════════════════════

const FOOTBALL_API_KEY    = process.env.FOOTBALL_API_KEY    || 'be77ce62269a45c2bcc06dcdb3b84915';
const SUPABASE_URL        = process.env.SUPABASE_URL        || 'https://zmhdhuvuegpjlcjhirnx.supabase.co';
const SUPABASE_ANON       = process.env.SUPABASE_ANON       || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptaGRodXZ1ZWdwamxjamhpcm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NDU1MzUsImV4cCI6MjA5MzIyMTUzNX0.Jwn1g4_mlW4Z_tnzf0-DjQ63fn8U_LTgroCHd7iwRo0';
// service_role key מאפשר למחוק ולכתוב מחדש ללא הגבלת RLS
// קבל אותו מ: Supabase Dashboard → Settings → API → service_role key
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || null;
const SB_KEY = SUPABASE_SERVICE_KEY || SUPABASE_ANON;

const FD_BASE = 'https://api.football-data.org/v4';
const DAYS_AHEAD = 7;

// ── מיפוי שמות אנגלית → עברית לקבוצות PL ─────────────────────
// football-data.org מחזיר שמות עם/בלי "FC" — מטפלים בשניהם
const PL_TEAM_MAP = {
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
  return PL_TEAM_MAP[name] || name;
}

// ── Supabase helper ───────────────────────────────────────────
async function sbInsert(rows) {
  var url = SUPABASE_URL + '/rest/v1/matches';
  var res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    var text = await res.text();
    throw new Error('sbInsert: ' + res.status + ' — ' + text);
  }
}

// ── מחיקת משחקי PL קיימים (לאפשר upsert נקי) ────────────────
async function sbDeletePL() {
  var url = SUPABASE_URL + '/rest/v1/matches?group_name=eq.' + encodeURIComponent('פרמייר ליג');
  var res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Prefer': 'return=minimal',
    }
  });
  if (res.ok || res.status === 204) {
    console.log('🗑️  נמחקו משחקי PL קיימים מהDB');
  } else {
    var text = await res.text();
    console.warn('   ⚠️  מחיקה לא הצליחה (' + res.status + '): ' + text);
  }
}

// ── שליפת משחקי PL מה-API ─────────────────────────────────────
async function fetchPLScheduled() {
  console.log('⚽ שולף משחקי פרמייר ליג מ-football-data.org...');
  // שולף משחקים מתאריך היום עד 7 ימים קדימה
  var now  = new Date();
  var from = now.toISOString().split('T')[0];
  var to   = new Date(now.getTime() + DAYS_AHEAD * 86400000).toISOString().split('T')[0];

  var url = FD_BASE + '/competitions/PL/matches?status=SCHEDULED&dateFrom=' + from + '&dateTo=' + to;
  var res = await fetch(url, {
    headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
  });
  if (!res.ok) {
    var text = await res.text();
    throw new Error('football-data.org: ' + res.status + ' — ' + text);
  }
  var data = await res.json();
  return data.matches || [];
}

// ── main ───────────────────────────────────────────────────────
async function main() {
  if (!SUPABASE_SERVICE_KEY) {
    console.log('ℹ️  רץ עם anon key. אם יש שורות PL קיימות בDB, המחיקה תיחסם על ידי RLS.');
    console.log('   לביצוע עדכון מלא: SUPABASE_SERVICE_KEY=<key> node import-pl-matches.js');
    console.log('   את ה-key תמצא ב: Supabase Dashboard → Settings → API → service_role key\n');
  }

  var apiMatches = await fetchPLScheduled();
  console.log('📦 נמצאו ' + apiMatches.length + ' משחקים קרובים בפרמייר ליג');

  if (apiMatches.length === 0) {
    console.log('ℹ️  אין משחקים קרובים ב-7 הימים הבאים.');
    return;
  }

  var rows = apiMatches.map(function(m) {
    var matchDate = new Date(m.utcDate);
    var lockDate  = new Date(matchDate.getTime() - 60 * 60 * 1000); // שעה לפני

    return {
      api_id:      'pl_' + m.id,
      match_date:  matchDate.toISOString(),
      lock_time:   lockDate.toISOString(),
      group_name:  'פרמייר ליג',
      stage:       'GROUP',
      home_team:   toHeb(m.homeTeam.name),
      away_team:   toHeb(m.awayTeam.name),
      home_flag:   '⚽',
      away_flag:   '⚽',
      has_extra_time: false,
      home_score:  null,
      away_score:  null,
      status:      'SCHEDULED',
    };
  });

  console.log('\n📋 משחקים לייבוא:');
  rows.forEach(function(r) {
    console.log('   ' + r.match_date.split('T')[0] + ' ' +
      r.match_date.split('T')[1].slice(0,5) + ' UTC  ' +
      r.home_team + ' נגד ' + r.away_team);
  });

  // מחק קודם (כדי לעדכן שמות קבוצות אם הסתיימו בצורה שגויה)
  await sbDeletePL();

  console.log('\n⬆️  שולח ל-Supabase...');
  await sbInsert(rows);
  console.log('✅ יובאו ' + rows.length + ' משחקים בהצלחה');
  console.log('\n🎉 סיום! עכשיו הכנס לאפליקציה → טאב "🧪 בדיקה" לראות את המשחקים.');
}

main().catch(function(err) {
  console.error('❌ שגיאה:', err.message);
  process.exit(1);
});
