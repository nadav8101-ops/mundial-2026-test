// ═══════════════════════════════════════════════════════════════
//  import-matches.js
//  מושך את כל 104 משחקי מונדיאל 2026 מ-GitHub (openfootball)
//  ומכניס אותם לטבלת matches ב-Supabase
//
//  הרצה:  node import-matches.js
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL  = 'https://zmhdhuvuegpjlcjhirnx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptaGRodXZ1ZWdwamxjamhpcm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NDU1MzUsImV4cCI6MjA5MzIyMTUzNX0.Jwn1g4_mlW4Z_tnzf0-DjQ63fn8U_LTgroCHd7iwRo0';

// ── כתובת ה-JSON של openfootball ─────────────────────────────
const DATA_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

// ── מיפוי שמות באנגלית → עברית + דגלים ──────────────────────
const TEAM_MAP = {
  // Group A
  'Mexico':              { he: 'מקסיקו',        flag: '🇲🇽' },
  'South Africa':        { he: 'דרום אפריקה',   flag: '🇿🇦' },
  'South Korea':         { he: 'דרום קוריאה',   flag: '🇰🇷' },
  // Group B
  'Canada':              { he: 'קנדה',           flag: '🇨🇦' },
  'Qatar':               { he: 'קטאר',           flag: '🇶🇦' },
  'Switzerland':         { he: 'שוויץ',          flag: '🇨🇭' },
  // Group C
  'Brazil':              { he: 'ברזיל',          flag: '🇧🇷' },
  'Morocco':             { he: 'מרוקו',          flag: '🇲🇦' },
  'Haiti':               { he: 'האיטי',          flag: '🇭🇹' },
  'Scotland':            { he: 'סקוטלנד',        flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  // Group D
  'USA':                 { he: 'ארה״ב',          flag: '🇺🇸' },
  'Paraguay':            { he: 'פרגוואי',        flag: '🇵🇾' },
  'Australia':           { he: 'אוסטרליה',       flag: '🇦🇺' },
  // Group E
  'Germany':             { he: 'גרמניה',         flag: '🇩🇪' },
  'Curaçao':             { he: 'קוראסאו',        flag: '🇨🇼' },
  'Ivory Coast':         { he: 'חוף השנהב',      flag: '🇨🇮' },
  'Ecuador':             { he: 'אקוודור',        flag: '🇪🇨' },
  // Group F
  'Netherlands':         { he: 'הולנד',          flag: '🇳🇱' },
  'Japan':               { he: 'יפן',            flag: '🇯🇵' },
  'Tunisia':             { he: 'טוניסיה',        flag: '🇹🇳' },
  // Group G
  'Belgium':             { he: 'בלגיה',          flag: '🇧🇪' },
  'Egypt':               { he: 'מצרים',          flag: '🇪🇬' },
  'Iran':                { he: 'איראן',          flag: '🇮🇷' },
  'New Zealand':         { he: 'ניו זילנד',      flag: '🇳🇿' },
  // Group H
  'Spain':               { he: 'ספרד',           flag: '🇪🇸' },
  'Cape Verde':          { he: 'כף ורדה',        flag: '🇨🇻' },
  'Saudi Arabia':        { he: 'ערב הסעודית',    flag: '🇸🇦' },
  'Uruguay':             { he: 'אורוגוואי',      flag: '🇺🇾' },
  // Group I
  'France':              { he: 'צרפת',           flag: '🇫🇷' },
  'Senegal':             { he: 'סנגל',           flag: '🇸🇳' },
  'Norway':              { he: 'נורווגיה',       flag: '🇳🇴' },
  // Group J
  'Argentina':           { he: 'ארגנטינה',       flag: '🇦🇷' },
  'Algeria':             { he: 'אלג׳יריה',      flag: '🇩🇿' },
  'Austria':             { he: 'אוסטריה',        flag: '🇦🇹' },
  'Jordan':              { he: 'ירדן',           flag: '🇯🇴' },
  // Group K
  'Portugal':            { he: 'פורטוגל',        flag: '🇵🇹' },
  'Uzbekistan':          { he: 'אוזבקיסטן',     flag: '🇺🇿' },
  'Colombia':            { he: 'קולומביה',       flag: '🇨🇴' },
  // Group L
  'England':             { he: 'אנגליה',         flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  'Croatia':             { he: 'קרואטיה',        flag: '🇭🇷' },
  'Ghana':               { he: 'גאנה',           flag: '🇬🇭' },
  'Panama':              { he: 'פנמה',           flag: '🇵🇦' },
  // Playoff winners (TBD)
  'Czech Republic':      { he: 'צ׳כיה',          flag: '🇨🇿' },
};

// ── מיפוי round → stage לחישוב ניקוד ────────────────────────
function getStage(round) {
  if (round.startsWith('Matchday'))     return 'GROUP';
  if (round === 'Round of 32')          return 'R32';
  if (round === 'Round of 16')          return 'R16';
  if (round === 'Quarter-final')        return 'QF';
  if (round === 'Semi-final')           return 'SF';
  if (round === 'Third place')          return 'THIRD';
  if (round === 'Final')                return 'FINAL';
  return 'GROUP';
}

// ── המרת זמן עם UTC offset לתאריך ISO ──────────────────────
function parseDateTime(dateStr, timeStr) {
  // timeStr examples: "13:00 UTC-6", "20:00 UTC-7", "15:00 UTC-4"
  const [timePart, utcPart] = timeStr.split(' ');
  const [hours, minutes] = timePart.split(':').map(Number);

  let offsetHours = 0;
  if (utcPart) {
    const match = utcPart.match(/UTC([+-]?\d+)/);
    if (match) offsetHours = parseInt(match[1]);
  }

  // Create date in UTC by subtracting the offset
  const d = new Date(`${dateStr}T${timePart}:00Z`);
  d.setHours(d.getHours() - offsetHours);
  return d.toISOString();
}

// ── שליחת נתונים ל-Supabase ──────────────────────────────────
async function supabaseRequest(method, table, body) {
  // מציין במפורש אילו עמודות לשלוח — כך Supabase לא ינסה לשלוח NULL ל-id
  const columns = [
    'api_id','match_date','lock_time','group_name','stage',
    'home_team','away_team','home_flag','away_flag','has_extra_time',
    'home_score','away_score','home_score_et','away_score_et',
    'home_score_pen','away_score_pen','status'
  ].join(',');

  const url = `${SUPABASE_URL}/rest/v1/${table}?columns=${columns}&on_conflict=api_id`;
  const headers = {
    'apikey':        SUPABASE_ANON,
    'Authorization': `Bearer ${SUPABASE_ANON}`,
    'Content-Type':  'application/json',
    'Prefer':        'resolution=merge-duplicates,return=minimal',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table} failed: ${res.status} — ${text}`);
  }
  return res;
}

// ── פונקציה ראשית ────────────────────────────────────────────
async function main() {
  console.log('🌍 מוריד נתוני משחקים מ-openfootball...');

  // 1. הורד את ה-JSON
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('Failed to fetch data: ' + res.status);
  const data = await res.json();
  const matches = data.matches;

  console.log(`✅ נמצאו ${matches.length} משחקים`);

  // 2. מפה כל משחק למבנה של Supabase
  const rows = matches.map((m, idx) => {
    const team1Info = TEAM_MAP[m.team1] || { he: m.team1, flag: '🏳️' };
    const team2Info = TEAM_MAP[m.team2] || { he: m.team2, flag: '🏳️' };

    const stage = getStage(m.round);
    const isKnockout = stage !== 'GROUP' && stage !== 'R32';

    // חישוב match_date
    let matchDate;
    try {
      matchDate = parseDateTime(m.date, m.time);
    } catch {
      matchDate = `${m.date}T18:00:00Z`; // fallback
    }

    // lock_time = שעה לפני המשחק
    const lockDate = new Date(matchDate);
lockDate.setMinutes(lockDate.getMinutes() - 5);   // 5 דקות לפני

    // Group name בעברית
    let groupName = m.group || m.round;
    if (m.group) {
      groupName = m.group.replace('Group ', 'בית ');
    }

    return {
      api_id:          `wc26_${m.num || (idx + 1)}`,
      match_date:      matchDate,
      lock_time:       lockDate.toISOString(),
      group_name:      groupName,
      stage:           stage,
      home_team:       team1Info.he,
      away_team:       team2Info.he,
      home_flag:       team1Info.flag,
      away_flag:       team2Info.flag,
      has_extra_time:  isKnockout,
      home_score:      m.score ? m.score.ft[0] : null,
      away_score:      m.score ? m.score.ft[1] : null,
      home_score_et:   null,
      away_score_et:   null,
      home_score_pen:  null,
      away_score_pen:  null,
      status:          m.score ? 'FINISHED' : 'SCHEDULED',
    };
  });

  console.log('\n📋 דוגמה לרשומה ראשונה:');
  console.log(JSON.stringify(rows[0], null, 2));

  // 3. שלח ל-Supabase בבאצ'ים של 20
  const BATCH = 20;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      await supabaseRequest('POST', 'matches', batch);
      inserted += batch.length;
      console.log(`⬆️  הוכנסו ${inserted}/${rows.length}...`);
    } catch (err) {
      console.error(`❌ שגיאה בבאצ' ${i}:`, err.message);
      console.log('\n⚠️  אם הטבלה לא קיימת, צור אותה קודם. הנה ה-SQL:\n');
      printCreateTableSQL();
      return;
    }
  }

  console.log(`\n🎉 סיום! ${inserted} משחקים הוכנסו בהצלחה ל-Supabase.`);
  console.log('📊 סיכום:');

  // סיכום לפי שלב
  const stages = {};
  rows.forEach(r => { stages[r.stage] = (stages[r.stage] || 0) + 1; });
  Object.entries(stages).forEach(([s, c]) => console.log(`   ${s}: ${c} משחקים`));
}

// ── SQL ליצירת הטבלה (אם לא קיימת) ─────────────────────────
function printCreateTableSQL() {
  console.log(`
-- ═══════════════════════════════════════════
--  SQL ליצירת טבלת matches ב-Supabase
--  הרץ ב-Dashboard → SQL Editor
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS matches (
  id              SERIAL PRIMARY KEY,
  api_id          TEXT UNIQUE NOT NULL,
  match_date      TIMESTAMPTZ NOT NULL,
  lock_time       TIMESTAMPTZ NOT NULL,
  group_name      TEXT,
  stage           TEXT NOT NULL DEFAULT 'GROUP',
  home_team       TEXT NOT NULL,
  away_team       TEXT NOT NULL,
  home_flag       TEXT DEFAULT '🏳️',
  away_flag       TEXT DEFAULT '🏳️',
  has_extra_time  BOOLEAN DEFAULT FALSE,
  home_score      INTEGER,
  away_score      INTEGER,
  home_score_et   INTEGER,
  away_score_et   INTEGER,
  home_score_pen  INTEGER,
  away_score_pen  INTEGER,
  status          TEXT DEFAULT 'SCHEDULED',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- אפשר קריאה לכולם, כתיבה רק למשתמשים מחוברים
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read matches"
  ON matches FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert matches"
  ON matches FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anon can insert matches"
  ON matches FOR INSERT
  TO anon
  WITH CHECK (true);
  `);
}

// ── הרצה ─────────────────────────────────────────────────────
main().catch(err => {
  console.error('❌ שגיאה כללית:', err.message);
});
