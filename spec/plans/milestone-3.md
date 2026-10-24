# תוכנית Milestone 3 - יציאה וחזרה בטוחה למשחק

מבוסס על: PRD (סעיף 4 - מקרי קצה: מעבר לאודות, מעבר לאפליקציה אחרת/נעילה, כשל צליל), ARCHITECTURE (סעיפים 4.1–4.3, ADR-3, ADR-7) ו-MILESTONES (Milestone 3).
נקודת המוצא: הקוד הקיים מ-Milestone 2. השהיה בסיסית במעבר לאודות כבר קיימת (`controller.onScreenChange`, `pause`/`resume` במנוע, `runToken`, `player.cancel()`).

## 1. מה נבנה

- **מעבר לרקע / נעילת מכשיר:** כשהדף מוסתר (Page Visibility או `pagehide`) — עצירת הארה, שמע ו-Timers, והשהיית משחק פעיל.
- **חזרה לקדמת המסך:** אם מסך הבית גלוי — השלב הנוכחי מוצג מחדש מתחילתו (כמו בחזרה מאודות). אם האודות גלוי — המשחק נשאר מושהה עד ״חזרה למשחק״.
- **BFCache:** חזרה לדף מ-BFCache (`pageshow` עם `persisted`) מתנהגת כמו חזרה לקדמת המסך; אין Timers ישנים שממשיכים לרוץ.
- **שמע לאחר חזרה:** ניסיון לחדש את ה-AudioContext. אם הדפדפן חוסם — המשחק ממשיך באורות, מוצגת הודעת השמע הקיימת, וננסה שוב בלחיצה הבאה של המשתמש. כשהשמע חוזר — ההודעה נעלמת.
- **השלמת בדיקות המעברים** מ-Milestone 2: באמצע הצגת הרצף, באמצע תשובה, בין שלבים, לפני משחק ואחרי סיום, ומעברים מהירים וחוזרים.

**ללא שינוי בממשק:** אין מסך, פקד או נוסח חדש. ההודעה בכשל שמע היא ההודעה הקיימת (`TEXT.audioFailed`).

**לא נכלל:** PWA/Offline (Milestone 4); בדיקת נעילה ושמע בטלפונים אמיתיים (Milestone 5).

## 2. קבצים

### חדשים

| קובץ | תפקיד |
| --- | --- |
| `src/lifecycle.ts` | מאזין לאירועי מחזור החיים של הדף ומתרגם אותם לשני Callbacks בלבד: `onHide()` ו-`onShow()`. מקבל `document`/`window` מוזרקים (לבדיקות). |
| `tests/unit/lifecycle.test.ts` | בדיקות התרגום עם `EventTarget` מדומה. |
| `tests/unit/audio.test.ts` | בדיקות Audio Adapter עם AudioContext מדומה: חסימה, חזרה, דיווח סטטוס. |
| `tests/e2e/lifecycle.spec.ts` | בדיקות דפדפן למעבר לרקע, BFCache ושמע חסום (ראה סעיף 7). |

### משתנים

| קובץ | שינוי |
| --- | --- |
| `src/controller.ts` | מעקב אחר המסך הנוכחי; פונקציות חדשות `onHide()` ו-`onShow()`; ניסיון חידוש שמע בלחיצת צבע. |
| `src/audio.ts` | זיהוי שמע מושהה/חסום גם מחוץ ל-`unlock()`, האזנה ל-`statechange`, ודיווח על חזרת השמע. |
| `src/main.ts` | חיבור `createLifecycle` ל-Controller. |
| `tests/unit/controller.test.ts` | בדיקות מעברים נוספות (סעיף 7). |
| `spec/ARCHITECTURE.md` | הוספת ADR-10 ו-ADR-11 (סעיף 8). |
| `spec/MILESTONES.md` | סימון 🟡 בסיום הבנייה. |

אין צורך בשינוי ב-`index.html`, `src/view.ts`, `src/styles.css`, `src/navigation.ts` או במנוע (`pause`/`resume` הקיימים מספיקים).

## 3. Lifecycle (`src/lifecycle.ts`)

```
createLifecycle({ onHide, onShow }, { doc = document, win = window })
```

| אירוע | פעולה |
| --- | --- |
| `visibilitychange` כש-`doc.visibilityState === 'hidden'` | `onHide()` |
| `visibilitychange` כש-`visible` | `onShow()` |
| `pagehide` | `onHide()` |
| `pageshow` עם `event.persisted === true` ו-`visible` | `onShow()` (חזרה מ-BFCache) |

- כפילויות (למשל `visibilitychange` ואחריו `pagehide`) מותרות: ה-Controller מטפל בהן באופן אידמפוטנטי (קריאה שנייה אינה משנה דבר).
- `pageshow` בטעינה רגילה (`persisted === false`) מתעלם — טעינה מלאה ממילא מתחילה במצב המתנה.
- אין שימוש ב-`unload`/`beforeunload` (פוגעים ב-BFCache).

## 4. Controller

### מעקב מסך
משתנה `screen: Screen` (התחלה: `INITIAL_SCREEN`), מתעדכן ב-`onScreenChange`.

### `onHide()`
1. `stopEverything()` תמיד — מבטל נגינה, Timers של הנגן ושל משוב הלחיצה, מכבה אורות ומעלה `runToken`. בטוח גם במצב המתנה או סיום.
2. אם המשחק פעיל (`playback`/`input`, כולל ההפסקה שבין שלבים) — `state = pause(state)` ו-`view.render(state)`.
3. במצב `paused`, `idle`, `won`, `lost` — אין שינוי מצב.

### `onShow()`
- אם `state.phase === 'paused'` **וגם** `screen === 'home'` — `audio.unlock()` (ניסיון, ללא מחוות משתמש), `state = resume(state)`, `runStage()`.
- אחרת — כלום. (אודות גלוי ← נשאר מושהה עד ״חזרה למשחק״, שכבר מטופל ב-`onScreenChange`.)
- קריאה שנייה רצופה היא No-op, כי אחרי הראשונה המצב כבר אינו `paused`.

### ניסיון חוזר לשמע
בתחילת `pressPad` (לפני בדיקת המנוע) — `audio.unlock()`. הלחיצה היא מחוות משתמש, ולכן כאן הדפדפן מאפשר לחדש שמע שנחסם. `unlock()` הוא No-op כשהשמע כבר פועל. (״התחל״, ״שחקו שוב״ ו״חזרה למשחק״ כבר קוראים ל-`unlock()`.)

### שמירת התנהגות קיימת
- התחלה חדשה ורענון — ללא שינוי.
- `onHide`/`onShow` לעולם אינם כותבים תוצאה ואינם מתחילים משחק חדש.
- משחק שהסתיים אינו ״משוחזר״: `resume` פועל רק מ-`paused`.

## 5. Audio Adapter

מצבי AudioContext אפשריים: `running`, `suspended`, `interrupted` (Safari), `closed`.

- **`statechange`:** מאזין אחד על ה-Context ברגע יצירתו. `running` ← `report(true)` (ההודעה נעלמת). מצב אחר בזמן שהדף גלוי ← לא מדווחים מיד (ראה סעיף הבא), כדי לא להציג הודעה סתם כשהדפדפן משהה ברקע.
- **`play()` כשה-Context קיים אך אינו `running`:** `report(false)` (מוצגת ההודעה הקיימת), ניסיון שקט ל-`resume()`, והצליל לא מושמע. כך ״חסימה״ מזוהה בדיוק כשהמשחק אמור להשמיע צליל ולא מצליח.
- **`unlock()`:** כמו היום, אבל ההבטחה של `resume()` עשויה לא להסתיים כשהדפדפן חוסם — לכן אין להסתמך עליה בלבד; הדיווח החיובי מגיע מ-`statechange`, והשלילי מ-`play()`.
- **`stopAll()`:** ללא שינוי.
- כשל שמע לעולם אינו זורק שגיאה למשחק ואינו עוצר את רצף האורות.

## 6. החלטות מימוש (יוצגו לבדיקת המשתמש)

1. בחזרה לקדמת המסך כשהבית גלוי, השלב מתחיל מחדש **אוטומטית** אחרי ההפסקה הקבועה (`ROUND_PAUSE_MS`), כפי שנקבע ב-ARCHITECTURE 4.3 — בלי כפתור ״המשך״.
2. בשמע חסום משתמשים בהודעה הקיימת ״לא ניתן להשמיע צלילים. אפשר להמשיך לשחק עם האורות.״, והיא נעלמת כשהשמע חוזר.
3. ניסיון חידוש השמע נעשה בכל לחיצה על צבע (וגם ב״התחל״, ״שחקו שוב״, ״חזרה למשחק״).

## 7. בדיקות

### Vitest — `tests/unit/controller.test.ts` (תוספות)
- `onHide` באמצע Playback: אורות כבויים, `stopAll` נקרא, המצב `paused`; קידום הזמן אינו מדליק דבר.
- `onHide` באמצע תשובה (אחרי לחיצה נכונה אחת) ← `onShow` עם בית גלוי: אותו רצף מוצג מתחילתו, `inputIndex = 0`, הניקוד נשמר, אין צבע נוסף.
- `onHide` בהפסקה שבין שלבים (מיד אחרי השלמת שלב) ← `onShow`: מוצג הרצף של השלב החדש, ללא צבע נוסף מעבר לו.
- אודות ← `onHide` ← `onShow`: נשאר `paused`; רק ״חזרה למשחק״ (מעבר לבית) ממשיך.
- `onHide`/`onShow` במצב המתנה ואחרי ניצחון/הפסד: המצב והתוצאה השמורה לא משתנים, `results.save` לא נקרא שוב.
- מעברים מהירים: `onHide`, `onShow`, `onHide`, `onShow` ברצף מהיר ושילוב עם אודות — רצף אחד בלבד מוצג (בדיקת רצף ההארות), הניקוד לא גדל.
- `onShow` כפול: אין שני רצפים חופפים.
- Callback ממחזור שבוטל (`player.play` של המחזור הקודם מסתיים) אינו מעביר ל-`input`.
- `pressPad` קורא ל-`audio.unlock()`.

### Vitest — `tests/unit/lifecycle.test.ts`
- `visibilitychange` hidden/visible, `pagehide`, `pageshow` עם ובלי `persisted` ← ה-Callback הנכון או אף אחד.

### Vitest — `tests/unit/audio.test.ts`
- `window.AudioContext` מדומה (`vi.stubGlobal`): Context במצב `suspended` + `play()` ← דיווח `false`, ניסיון `resume`, אין Oscillator.
- מעבר ל-`running` (`statechange`) ← דיווח `true`.
- `unlock()` כש-`resume()` לעולם לא מסתיים ← אין קריסה; `play()` הבא מדווח `false`.
- אין Web Audio ← דיווח `false` (קיים כבר בהתנהגות, נבדק כאן ביחידה).

### Playwright — `tests/e2e/lifecycle.spec.ts`
מדמים מעבר לרקע מתוך הדף: הגדרת `document.visibilityState`/`hidden` עם `Object.defineProperty` ושיגור `visibilitychange`; ל-BFCache — שיגור `pagehide` ואחריו `PageTransitionEvent('pageshow', { persisted: true })`. (BFCache אמיתי אינו זמין באופן אמין בדפדפני הבדיקה; ראה ADR-11.)
- רקע באמצע Playback ← אין הארות במשך 5 שניות ← חזרה: ״שלב N · צפו ברצף״ ואותו רצף.
- רקע באמצע תשובה ← חזרה: התשובה החלקית נמחקת, הניקוד נשמר, אותו רצף.
- אודות ← רקע ← חזרה: נשאר מושהה; ״חזרה למשחק״ ממשיך.
- רקע במצב המתנה ואחרי סיום ← חזרה: לא מתחיל משחק, מסך הסיום נשאר, התוצאה באודות לא משתנה.
- מעברים מהירים חוזרים ← רצף אחד, ללא כפילות.
- `pagehide` + `pageshow(persisted)` ← אין Timers ישנים (אין הארה לפני ההפסקה הקבועה), השלב מוצג מחדש.
- שמע חסום: AudioContext מדומה שנכנס ל-`suspended` ברקע ו-`resume()` שלו לא מצליח בלי לחיצה ← אחרי חזרה: האורות ממשיכים, ההודעה בעברית מוצגת, אפשר להשלים את השלב; לחיצה על צבע ← ה-Context חוזר ל-`running` וההודעה נעלמת.
- Reload באמצע משחק ← מצב המתנה, התוצאה השמורה נשארת (קיים ב-`game.spec.ts`; לוודא שעדיין עובר).

### בדיקה ידנית בדפדפן (בזמן הבנייה)
- בדפדפן המובנה: התחלת משחק, מעבר ללשונית אחרת וחזרה (מעבר רקע אמיתי) — באמצע הצגה ובאמצע תשובה, ועם אודות גלוי. תיעוד התוצאה בדוח הסיום.
- בדיקת נעילה ושמע בטלפון אמיתי — נדחית ל-Milestone 5, כפי שמוגדר ב-MILESTONES.

### כללי
`npm run typecheck`, `npm test`, `npm run test:e2e` (Chromium ו-WebKit), ו-Build — כולם עוברים, כולל כל הבדיקות הקיימות.

## 8. ADRs להוספה ב-ARCHITECTURE.md

- **ADR-10: מחזור חיי הדף דרך מודול `lifecycle` אחד** — `visibilitychange`, `pagehide` ו-`pageshow(persisted)` מתורגמים ל-`onHide`/`onShow`; ה-Controller אידמפוטנטי ומחליט לפי המסך הגלוי; ללא `unload`.
- **ADR-11: זיהוי שמע חסום וניסיון חוזר בלחיצה הבאה; בדיקות רקע מדומות** — דיווח שלילי מ-`play()` וחיובי מ-`statechange`; ניסיון חידוש בכל לחיצה; הודעה קיימת. בדיקות Playwright מדמות Visibility ו-BFCache מתוך הדף, ובנוסף בדיקה ידנית של מעבר לשונית; נעילת מכשיר נבדקת ב-Milestone 5.

## 9. סדר עבודה

1. `src/lifecycle.ts` + בדיקות יחידה.
2. Controller: מעקב מסך, `onHide`/`onShow`, `unlock` בלחיצה + בדיקות יחידה.
3. Audio Adapter: `statechange` ודיווח מ-`play()` + בדיקות יחידה.
4. חיבור ב-`src/main.ts`.
5. בדיקות Playwright חדשות; הרצת כל הבדיקות.
6. בדיקה ידנית של מעבר לשונית בדפדפן המובנה.
7. ADRs, מעבר על ה-Definition of Done, סימון 🟡.

## 10. Definition of Done — מיפוי

| תנאי | איך נבדק |
| --- | --- |
| אודות באמצע Playback/קלט: עצירה, אותו רצף מתחילתו, תשובה חלקית נמחקת, ניקוד נשמר | קיים + Vitest/Playwright מורחבים |
| מעבר לפני משחק או אחרי סיום אינו מתחיל/משחזר משחק | Vitest + Playwright |
| רקע וחזרה עם בית גלוי ממשיכים; עם אודות גלוי נשאר מושהה | Vitest + Playwright + בדיקה ידנית |
| מעברים מהירים אינם מכפילים רצפים, מאזינים או ניקוד; Callbacks מבוטלים אינם משנים State | Vitest + Playwright |
| BFCache ללא Timers ישנים; Reload מאפס ושומר תוצאה | Playwright (מדומה) + בדיקה קיימת |
| AudioContext חסום: משוב חזותי והודעה בעברית, בלי חסימה | Vitest + Playwright |
| בדיקות אוטומטיות למעברים + בדיקות קיימות עוברות + בדיקת רקע בדפדפן | הרצת כל הבדיקות + בדיקה ידנית |
