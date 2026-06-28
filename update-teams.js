// update-teams.js
// ═══════════════════════════════════════════════════════════════
//  מעדכן שמות קבוצות לכל שלבי הנוקאאוט:
//  R32, R16, QF, SF, FINAL, THIRD
//
//  בכל הרצה:
//    - שולף את כל המשחקים מה-API (כולל עתידיים)
//    - מעדכן שמות + דגלים + has_extra_time לכל שלב נוקאאוט
//    - מעדכן תוצאות אם המשחק כבר הסתיים
//    - מדלג על TBD (עדיין לא ידוע מי משחק)
//
//  הרצה: node update-teams.js
// ═══════════════════════════════════════════════════════════════

const FOOTBALL_API_KEY   = process.env.FOOTBALL_API_KEY   || 'YOUR_FOOTBALL_DATA_API_KEY';
const SUPABASE_URL       = process.env.SUPABASE_URL       || 'https://zmhdhuvuegpjlcjhirnx.supabase.co';
const SUPABASE_WRITE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON;
const FD_BASE            = 'https://api.football-data.org/v4';
const WC_CODE            = 'WC';

// ── מיפוי שמות אנגלית → עברית ─────────────────────────────────
const NAME_MAP = {
  'Mexico':'מקסיקו','South Korea':'דרום קוריאה','Korea Republic':'דרום קוריאה',
  'Canada':'קנדה','Qatar':'קטאר','Switzerland':'שוויץ','Brazil':'ברזיל',
  'Morocco':'מרוקו','USA':'ארה״ב','United States':'ארה״ב','Australia':'אוסטרליה',
  'Germany':'גרמניה','Ecuador':'אקוודור','Netherlands':'הולנד','Japan':'יפן',
  'Tunisia':'טוניסיה','Belgium':'בלגיה','Egypt':'מצרים','Iran':'איראן',
  'New Zealand':'ניו זילנד','Spain':'ספרד','Cape Verde':'כף ורדה',
  'Cape Verde Islands':'כף ורדה','Cabo Verde':'כף ורדה',
  'Saudi Arabia':'ערב הסעודית','Uruguay':'אורוגוואי','France':'צרפת',
  'Senegal':'סנגל','Norway':'נורווגיה','Argentina':'ארגנטינה',
  'Algeria':'אלג׳יריה','Austria':'אוסטריה','Jordan':'ירדן',
  'Portugal':'פורטוגל','Uzbekistan':'אוזבקיסטן','Colombia':'קולומביה',
  'England':'אנגליה','Croatia':'קרואטיה','Ghana':'גאנה','Panama':'פנמה',
  'Czech Republic':'צ׳כיה','Czechia':'צ׳כיה','Poland':'פולין',
  'Serbia':'סרביה','Denmark':'דנמרק','Turkey':'טורקיה','Türkiye':'טורקיה',
  'Wales':'וויילס','Sweden':'שוודיה','Ukraine':'אוקראינה','Romania':'רומניה',
  'Slovenia':'סלובניה','Slovakia':'סלובקיה','Greece':'יוון','Hungary':'הונגריה',
  'Iceland':'איסלנד','Cameroon':'קמרון','Nigeria':'ניגריה',
  'DR Congo':'קונגו','Congo DR':'קונגו','Congo (DR)':'קונגו',
  'Mali':'מאלי','Burkina Faso':'בורקינה פאסו','Tanzania':'טנזניה',
  'China PR':'סין','China':'סין','Indonesia':'אינדונזיה','Iraq':'עיראק',
  'Bahrain':'בחריין','Costa Rica':'קוסטה ריקה','Honduras':'הונדורס',
  'Jamaica':'ג׳מייקה','El Salvador':'אל סלבדור',
  'Trinidad and Tobago':'טרינידד וטובגו','Peru':'פרו','Chile':'צ׳ילה',
  'Venezuela':'ונצואלה','Bolivia':'בוליביה','IR Iran':'איראן',
  'Ivory Coast':'חוף השנהב',"Côte d'Ivoire":'חוף השנהב',
  'Paraguay':'פרגוואי','Ecuador':'אקוודור','Scotland':'סקוטלנד',
  'South Africa':'דרום אפריקה','Haiti':'האיטי','Curaçao':'קוראסאו',
  'New Caledonia':'ניו קלדוניה','Tahiti':'טהיטי','Cuba':'קובה',
  'Nicaragua':'ניקרגואה','Guatemala':'גואטמלה','Belize':'בליז',
  'Suriname':'סורינאם','Guyana':'גיאנה',
};

const toHeb  = n => NAME_MAP[n] || n;
const toFlag = n => ({
  'ארגנטינה':'🇦🇷','ברזיל':'🇧🇷','ספרד':'🇪🇸','גרמניה':'🇩🇪','צרפת':'🇫🇷',
  'אנגליה':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','פורטוגל':'🇵🇹','הולנד':'🇳🇱','מרוקו':'🇲🇦','יפן':'🇯🇵',
  'מקסיקו':'🇲🇽','פולין':'🇵🇱','ארה״ב':'🇺🇸','קנדה':'🇨🇦','סנגל':'🇸🇳',
  'אורוגוואי':'🇺🇾','קרואטיה':'🇭🇷','בלגיה':'🇧🇪','דנמרק':'🇩🇰','שוויץ':'🇨🇭',
  'אוסטרליה':'🇦🇺','דרום קוריאה':'🇰🇷','איראן':'🇮🇷','ערב הסעודית':'🇸🇦',
  'קטאר':'🇶🇦','אקוודור':'🇪🇨','גאנה':'🇬🇭','קמרון':'🇨🇲','טוניסיה':'🇹🇳',
  'סרביה':'🇷🇸','טורקיה':'🇹🇷','כף ורדה':'🇨🇻','קולומביה':'🇨🇴',
  'אוזבקיסטן':'🇺🇿','יפן':'🇯🇵','ירדן':'🇯🇴','אוסטריה':'🇦🇹',
  'נורווגיה':'🇳🇴','אלג׳יריה':'🇩🇿','אינדונזיה':'🇮🇩','עיראק':'🇮🇶',
  'ניגריה':'🇳🇬','קונגו':'🇨🇩','מאלי':'🇲🇱','טנזניה':'🇹🇿','סין':'🇨🇳',
  'קוסטה ריקה':'🇨🇷','הונדורס':'🇭🇳','ג׳מייקה':'🇯🇲','פרו':'🇵🇪',
  'צ׳ילה':'🇨🇱','ונצואלה':'🇻🇪','בוליביה':'🇧🇴','פרגוואי':'🇵🇾',
  'פנמה':'🇵🇦','אל סלבדור':'🇸🇻','ניו זילנד':'🇳🇿','מצרים':'🇪🇬',
  'חוף השנהב':'🇨🇮','בורקינה פאסו':'🇧🇫','דרום אפריקה':'🇿🇦',
  'סלובניה':'🇸🇮','סלובקיה':'🇸🇰','יוון':'🇬🇷','הונגריה':'🇭🇺',
  'איסלנד':'🇮🇸','רומניה':'🇷🇴','אוקראינה':'🇺🇦','שוודיה':'🇸🇪',
  'וויילס':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','צ׳כיה':'🇨🇿','בוסניה והרצגובינה':'🇧🇦',
  'האיטי':'🇭🇹','קוראסאו':'🇨🇼','סקוטלנד':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'טרינידד וטובגו':'🇹🇹','גיאנה':'🇬🇾','סורינאם':'🇸🇷',
}[n] || '🏳️');

// ── Supabase helpers ────────────────────────────────────────────
async function sbGet(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { 'apikey': SUPABASE_WRITE_KEY, 'Authorization': `Bearer ${SUPABASE_WRITE_KEY}` }
  });
  if (!res.ok) throw new Error(`sbGet ${table}: ${res.status}`);
  return res.json();
}

async function sbPatch(table, query, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_WRITE_KEY,
      'Authorization': `Bearer ${SUPABASE_WRITE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbPatch: ${res.status} — ${await res.text()}`);
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 מעדכן שמות קבוצות לכל שלבי הנוקאאוט...\n');

  // 1. שלוף את כל המשחקים מה-API (כולל עתידיים — ללא פילטר status)
  console.log('📡 שולף מ-football-data.org...');
  const url = `${FD_BASE}/competitions/${WC_CODE}/matches`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } });
  if (!res.ok) throw new Error(`API: ${res.status} — ${await res.text()}`);
  const { matches: apiMatches } = await res.json();
  console.log(`   ${apiMatches.length} משחקים מה-API`);

  // 2. שלוף מ-DB רק את משחקי הנוקאאוט עם placeholder
  const dbMatches = await sbGet('matches', 'select=*&order=match_date.asc');
  console.log(`   ${dbMatches.length} משחקים ב-DB\n`);

  let updated = 0, skipped = 0, notFound = 0;

  // מיפוי שלבי API → DB
  const STAGE_MAP = {
    'LAST_32':        'R32',
    'LAST_16':        'R16',
    'QUARTER_FINALS': 'QF',
    'SEMI_FINALS':    'SF',
    'FINAL':          'FINAL',
    'THIRD_PLACE':    'THIRD',
  };

  // 3. עבור על כל משחקי הנוקאאוט מה-API
  for (const am of apiMatches) {
    // דלג על שלב בתים
    if (am.stage === 'GROUP_STAGE') continue;

    const homeEn  = am.homeTeam.name;
    const awayEn  = am.awayTeam.name;
    const homeHe  = toHeb(homeEn);
    const awayHe  = toHeb(awayEn);
    const apiDate = am.utcDate.split('T')[0];       // YYYY-MM-DD
    const apiHour = am.utcDate.split('T')[1]?.substring(0,5); // HH:MM

    // דלג אם ה-API עדיין לא יודע מי משחק (TBD)
    const homeTBD = !homeEn || homeEn === 'TBD' || homeEn.match(/^[0-9]/);
    const awayTBD = !awayEn || awayEn === 'TBD' || awayEn.match(/^[0-9]/);
    if (homeTBD || awayTBD) {
      console.log(`   ⏭️  TBD עדיין: ${am.stage} ${apiDate} (${homeEn} vs ${awayEn})`);
      skipped++;
      continue;
    }

    // מצא ב-DB לפי תאריך + שעה
    const dbMatch = dbMatches.find(dm => {
      const dbDate = dm.match_date.split('T')[0];
      const dbHour = dm.match_date.split('T')[1]?.substring(0,5);
      return dbDate === apiDate && dbHour === apiHour;
    });

    if (!dbMatch) {
      // נסה לפי תאריך בלבד (פחות מדויק)
      const byDate = dbMatches.find(dm => dm.match_date.split('T')[0] === apiDate);
      if (!byDate) {
        console.log(`   ❓ לא נמצא ב-DB: ${homeEn} vs ${awayEn} (${apiDate} ${apiHour})`);
        notFound++;
        continue;
      }
    }

    const target = dbMatch || dbMatches.find(dm => dm.match_date.split('T')[0] === apiDate);

    // אם הקבוצות כבר עודכנו — דלג
    if (target.home_team === homeHe && target.away_team === awayHe) {
      skipped++;
      continue;
    }

    // עדכן שמות + דגלים
    const dbStage = STAGE_MAP[am.stage] || am.stage;
    const patch = {
      home_team:      homeHe,
      away_team:      awayHe,
      home_flag:      toFlag(homeHe),
      away_flag:      toFlag(awayHe),
      stage:          dbStage,   // עדכן גם שלב נכון
      has_extra_time: true,      // כל שלב נוקאאוט = הארכה אפשרית
    };

    // גם תוצאה אם הסתיים
    if (am.status === 'FINISHED' && am.score?.fullTime) {
      const ft  = am.score.fullTime;
      const dur = am.score.duration;
      if (dur === 'EXTRA_TIME' || dur === 'PENALTY_SHOOTOUT') {
        patch.home_score    = am.score.regularTime?.home ?? ft.home;
        patch.away_score    = am.score.regularTime?.away ?? ft.away;
        patch.home_score_et = ft.home;
        patch.away_score_et = ft.away;
      } else {
        patch.home_score = ft.home;
        patch.away_score = ft.away;
      }
      if (dur === 'PENALTY_SHOOTOUT' && am.score.penalties) {
        patch.home_score_pen = am.score.penalties.home;
        patch.away_score_pen = am.score.penalties.away;
      }
      patch.status = 'FINISHED';
    }

    await sbPatch('matches', `id=eq.${target.id}`, patch);
    updated++;

    const result = patch.home_score !== undefined
      ? ` → ${patch.home_score}–${patch.away_score}`
      : '';
    console.log(`   ✅ [${dbStage}] ${homeHe} vs ${awayHe} (${apiDate})${result}`);
  }

  console.log(`\n📊 סיכום:`);
  console.log(`   עודכנו: ${updated}`);
  console.log(`   כבר עדכניים: ${skipped}`);
  console.log(`   לא נמצאו: ${notFound}`);
  console.log('\n🎉 סיום!');
}

main().catch(err => {
  console.error('❌ שגיאה:', err.message);
  process.exit(1);
});
