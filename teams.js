// ═══════════════════════════════════════════════════════════════
//  teams.js — מקור אמת יחיד לשמות קבוצות (עברית + דגל)
//
//  משותף ל-import-matches.js (openfootball) ול-update-results.js
//  (football-data.org). מכיל שכבת נירמול שמיישרת הבדלי איות בין
//  המקורות, כך ששם כמו "Bosnia & Herzegovina" / "Bosnia-Herzegovina"
//  / "Bosnia and Herzegovina" — כולם מפנים לאותה רשומה.
//
//  שימוש:
//    const { resolveTeam } = require('./teams.js');
//    const t = resolveTeam('Bosnia-Herzegovina');  // { he:'בוסניה והרצגובינה', flag:'🇧🇦', matched:true }
// ═══════════════════════════════════════════════════════════════

// ── מפת קנון: מפתח מנורמל → { he, flag } ─────────────────────
const CANON = {
  // Group A
  'mexico':              { he: 'מקסיקו',         flag: '🇲🇽' },
  'south africa':        { he: 'דרום אפריקה',    flag: '🇿🇦' },
  'south korea':         { he: 'דרום קוריאה',    flag: '🇰🇷' },
  'czechia':             { he: 'צ׳כיה',          flag: '🇨🇿' },
  // Group B
  'canada':              { he: 'קנדה',           flag: '🇨🇦' },
  'bosnia herzegovina':  { he: 'בוסניה והרצגובינה', flag: '🇧🇦' },
  'qatar':               { he: 'קטאר',           flag: '🇶🇦' },
  'switzerland':         { he: 'שוויץ',          flag: '🇨🇭' },
  // Group C
  'brazil':              { he: 'ברזיל',          flag: '🇧🇷' },
  'morocco':             { he: 'מרוקו',          flag: '🇲🇦' },
  'haiti':               { he: 'האיטי',          flag: '🇭🇹' },
  'scotland':            { he: 'סקוטלנד',        flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  // Group D
  'united states':       { he: 'ארה״ב',          flag: '🇺🇸' },
  'paraguay':            { he: 'פרגוואי',        flag: '🇵🇾' },
  'australia':           { he: 'אוסטרליה',       flag: '🇦🇺' },
  'turkiye':             { he: 'טורקיה',         flag: '🇹🇷' },
  // Group E
  'germany':             { he: 'גרמניה',         flag: '🇩🇪' },
  'curacao':             { he: 'קוראסאו',        flag: '🇨🇼' },
  'ivory coast':         { he: 'חוף השנהב',      flag: '🇨🇮' },
  'ecuador':             { he: 'אקוודור',        flag: '🇪🇨' },
  // Group F
  'netherlands':         { he: 'הולנד',          flag: '🇳🇱' },
  'japan':               { he: 'יפן',            flag: '🇯🇵' },
  'sweden':              { he: 'שוודיה',         flag: '🇸🇪' },
  'tunisia':             { he: 'טוניסיה',        flag: '🇹🇳' },
  // Group G
  'belgium':             { he: 'בלגיה',          flag: '🇧🇪' },
  'egypt':               { he: 'מצרים',          flag: '🇪🇬' },
  'iran':                { he: 'איראן',          flag: '🇮🇷' },
  'new zealand':         { he: 'ניו זילנד',      flag: '🇳🇿' },
  // Group H
  'spain':               { he: 'ספרד',           flag: '🇪🇸' },
  'cape verde':          { he: 'כף ורדה',        flag: '🇨🇻' },
  'saudi arabia':        { he: 'ערב הסעודית',    flag: '🇸🇦' },
  'uruguay':             { he: 'אורוגוואי',      flag: '🇺🇾' },
  // Group I
  'france':              { he: 'צרפת',           flag: '🇫🇷' },
  'senegal':             { he: 'סנגל',           flag: '🇸🇳' },
  'iraq':                { he: 'עיראק',          flag: '🇮🇶' },
  'norway':              { he: 'נורווגיה',       flag: '🇳🇴' },
  // Group J
  'argentina':           { he: 'ארגנטינה',       flag: '🇦🇷' },
  'algeria':             { he: 'אלג׳יריה',       flag: '🇩🇿' },
  'austria':             { he: 'אוסטריה',        flag: '🇦🇹' },
  'jordan':              { he: 'ירדן',           flag: '🇯🇴' },
  // Group K
  'portugal':            { he: 'פורטוגל',        flag: '🇵🇹' },
  'dr congo':            { he: 'קונגו',          flag: '🇨🇩' },
  'uzbekistan':          { he: 'אוזבקיסטן',      flag: '🇺🇿' },
  'colombia':            { he: 'קולומביה',       flag: '🇨🇴' },
  // Group L
  'england':             { he: 'אנגליה',         flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  'croatia':             { he: 'קרואטיה',        flag: '🇭🇷' },
  'ghana':               { he: 'גאנה',           flag: '🇬🇭' },
  'panama':              { he: 'פנמה',           flag: '🇵🇦' },
};

// ── כינויים: גרסת איות מנורמלת → מפתח קנוני ───────────────────
const ALIASES = {
  'czech republic':              'czechia',
  'korea republic':              'south korea',
  'korea dpr':                   'south korea', // ליתר ביטחון (אין צפון קוריאה בטורניר)
  'usa':                         'united states',
  'united states america':       'united states',
  'turkey':                      'turkiye',
  'cote d ivoire':               'ivory coast',
  'cabo verde':                  'cape verde',
  'cape verde islands':          'cape verde', // football-data.org מוסיף "Islands"
  'congo dr':                    'dr congo',
  'democratic republic congo':   'dr congo',
  'cape verde islands': 'cape verde',
  'congo':                       'dr congo', // אין קונגו-בראזוויל בטורניר
};

// ── נירמול שם: מסיר מבטאים, פיסוק ומילות-מילוי ───────────────
function normalize(name) {
  return (name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // הסר מבטאים (Côte → Cote)
    .toLowerCase()
    .replace(/[&\/\-.,'`’]/g, ' ')                       // & / - . , ' → רווח
    .replace(/\b(and|of|the)\b/g, ' ')                   // הסר מילות-מילוי
    .replace(/\s+/g, ' ')
    .trim();
}

// ── הפונקציה הראשית ──────────────────────────────────────────
function resolveTeam(rawName) {
  const n = normalize(rawName);
  const key = ALIASES[n] || n;
  const t = CANON[key];
  if (t) return { he: t.he, flag: t.flag, matched: true };
  // לא נמצא — מחזיר את השם המקורי ודגל לבן, ומדפיס אזהרה כדי שתשים לב
  console.warn('⚠️  teams.js: לא זוהתה קבוצה — "' + rawName + '" (מנורמל: "' + n + '")');
  return { he: rawName, flag: '🏳️', matched: false };
}

module.exports = { resolveTeam, normalize, CANON, ALIASES };
