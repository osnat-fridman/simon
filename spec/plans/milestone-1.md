# תוכנית Milestone 1 - בסיס עובד ושני מסכים

מקורות: [MILESTONES.md](../MILESTONES.md), [PRD.md](../PRD.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [DESIGN.md](../DESIGN.md) והתמונות `wireframes.png`, `mockups.png`, `style-guide.png`.

**מטרה:** פרויקט Vite + TypeScript שרץ מקומית, עם מסכי בית ואודות מעוצבים לפי ה-Mockups, ניווט פנימי ביניהם, בדיקות בסיס ו-CI. אין עדיין משחק, צליל, שמירת תוצאה או PWA.

## 0. מצב פתיחה ותנאים מקדימים

- בפרויקט אין עדיין קוד. קיימים `spec/`, `CLAUDE.md`, `.gitignore` ו-remote `origin` אל `github.com/osnat-fridman/simon` (Repository **ציבורי**).
- **Node.js ו-npm אינם מותקנים במחשב.** לפני הבנייה נדרש להתקין Node.js 24 LTS (למשל `brew install node@24`). אבקש אישור לפני ההתקנה.
- **חשיפת ה-Repository:** הוא ציבורי, בהתאם להנחת העלות ב-ARCHITECTURE (GitHub Pages חינמי). MILESTONES מבקש לאשר זאת מול המשתמש — לאשר לפני הבנייה.
- אין צורך ב-`.env`, מפתחות או חשבונות ב-Milestone זה.

## 1. קבצים ליצירה

```
package.json            # scripts, devDependencies, engines.node = 24
package-lock.json       # נוצר ע"י npm install, נעילת גרסאות מדויקות
.nvmrc                  # "24" – אותה גרסה בפיתוח וב-CI
tsconfig.json           # strict, noEmit, target ES2022, DOM libs
vite.config.ts          # base: '/simon/', הגדרות Vitest
playwright.config.ts    # webServer = vite preview, פרויקטים: Chromium + WebKit במובייל
index.html              # lang="he" dir="rtl", viewport, שני המסכים כ-<section>
src/main.ts             # נקודת כניסה: ייבוא סגנונות וגופן, הפעלת הניווט
src/navigation.ts       # מצב screen בזיכרון ('home' | 'about') והחלפת מסכים
src/styles.css          # Custom Properties, טיפוגרפיה, Header, לוח, כפתורים, כרטיס
tests/unit/navigation.test.ts   # Vitest
tests/e2e/navigation.spec.ts    # Playwright
.github/workflows/ci.yml        # בדיקות ו-Build, ללא פריסה
```

עדכונים לקבצים קיימים:
- `CLAUDE.md` — מילוי סעיף "פקודות הרצה" (`npm run dev`; בדיקות: `npm test` ו-`npm run test:e2e`).
- `ARCHITECTURE.md` — הוספת ADRs (סעיף 8 בתוכנית זו).
- `MILESTONES.md` — סימון 🟡 בסיום הבנייה.
- `.gitignore` — כבר מכסה `node_modules/`, `dist/`, `playwright-report/`, `test-results/`; אין צורך בשינוי אלא אם יתגלה צורך.

## 2. הקמת הפרויקט והכלים

- Vite 8 בתבנית `vanilla-ts` (נבנה ידנית לפי המבנה למעלה, בלי קובצי הדוגמה של התבנית).
- devDependencies: `vite@8`, `typescript`, `vitest`, `@playwright/test`. dependency: `@fontsource/heebo` (קובצי הגופן נארזים בתוך ה-Build — אין CDN).
- `vite-plugin-pwa` **לא** מותקן ב-Milestone זה (שייך ל-Milestone 4).
- גרסאות: מהדורות יציבות ותואמות בזמן ההתקנה, נעולות ב-`package-lock.json`. אין שימוש ב-`latest` בזמן Build.
- scripts:
  - `dev` — `vite`
  - `typecheck` — `tsc --noEmit`
  - `build` — `tsc --noEmit && vite build`
  - `preview` — `vite preview`
  - `test` — `vitest run`
  - `test:e2e` — `playwright test`
- `base: '/simon/'` כבר עכשיו, כדי שכל הנתיבים יתאימו מההתחלה ל-GitHub Pages (שם ה-Repository הוא `simon`). בפיתוח האתר ייפתח בכתובת `http://localhost:5173/simon/`.

## 3. מבנה HTML

- `<html lang="he" dir="rtl">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title>סיימון</title>`, `theme-color` = `#070B26`.
- `<main>` אחד ובו שני `<section>`:
  - `#screen-home` — גלוי בטעינה.
  - `#screen-about` — עם המאפיין `hidden` בטעינה.
- **בית** (סדר לפי ה-Wireframe):
  1. `<header>`: `<h1>סיימון</h1>` מימין; כפתור טקסט "אודות" משמאל (`<button type="button">` בעיצוב קישור — לא `<a href>`, כי אין נתיבים נפרדים).
  2. `<p>משחק זיכרון עם אורות וצלילים</p>`.
  3. לוח: `<div class="board">` ובו ארבעה `<button class="pad pad--{color}">` עם תווית טקסט ("כחול", "אדום", "צהוב", "ירוק") שמשמשת גם כשם הנגיש.
  4. כפתור ראשי "התחל".
- **אודות** (סדר לפי ה-Wireframe):
  1. `<header>` עם `<h1>אודות</h1>` מימין.
  2. `<p>סיימון הוא משחק זיכרון עם אורות וצלילים.</p>`
  3. `<h2>איך משחקים?</h2>` וחמש פסקאות ההוראות בנוסח המדויק מ-DESIGN 1.2.
  4. כרטיס תוצאה: כותרת "תוצאת המשחק האחרון" ומתחתיה מצב ללא תוצאה (ראה סעיף 6).
  5. כפתור משני "חזרה למשחק".

## 4. ניווט (`src/navigation.ts`)

- מצב בזיכרון בלבד: `screen: 'home' | 'about'`, התחלתי `'home'`. אין URL hash, אין History API, אין Local Storage — רענון תמיד פותח בית.
- `showScreen(screen)`: מעדכן את המצב, מסיר `hidden` מהמסך הנבחר ומוסיף אותו לשני. `hidden` מוציא את המסך המוסתר מהנגישות ומה-Tab order, כך שאין Focus על תוכן מוסתר.
- אחרי מעבר, Focus עובר לכותרת `h1` של המסך החדש (`tabindex="-1"`), כדי שמשתמשי מקלדת וקורא מסך יידעו שהמסך התחלף. גלילה לראש העמוד.
- פונקציה טהורה קטנה לחישוב המצב הבא (ללא DOM) כדי שתיבדק ב-Vitest; קוד ה-DOM מחובר ב-`main.ts`.
- הפרדה מראש: הקוד הזה הוא תחילת ה-"Views" וה-"Application Controller" שב-ARCHITECTURE; ב-Milestone 2 יתווספו לידו Game Engine וכו'. אין Router חיצוני.

## 5. עיצוב (`src/styles.css`)

**Tokens (`:root`)** — מתוך DESIGN 2.1–2.3:
- צבעים: `--bg #070B26`, `--surface #242A35`, `--text #F7F9FF`, `--text-2 #B8C4DC`, `--blue #19CFFF`, `--red #FF3548`, `--yellow #FFE23D`, `--green #66E34F`.
- מרווחים: `--s1 8px`, `--s2 16px`, `--s3 24px`, `--s4 32px`.
- רדיוסים: כפתור `16px`, כרטיס `20px`. קו מתאר `2px`.
- גופן: `'Heebo', Arial, sans-serif`. משקלים 400/700/800 מ-`@fontsource/heebo` (subset עברית + לטינית).
- טיפוגרפיה: Display 32/800, Heading 24/700, Subheading 20/700, Body 16/400, Button 18/700. line-height: כותרות 1.2, טקסט 1.5.

**פריסה כללית:**
- `body` ברקע Navy; עמודה אחת, `max-width` של כ-480px ממורכזת (אין התאמה ייעודית ל-Desktop, רק שלא יימתח), שוליים פנימיים 16px.
- `overflow-x: hidden` לא משמש כפתרון — הפריסה עצמה לא חורגת ברוחב. גלילה אנכית מותרת כשהתוכן ארוך.
- מתחת ללוח וה"התחל" — שטח פנוי, ללא רכיבים נוספים.

**Header:** משטח כהה מעט בהיר מהרקע, פינות מעוגלות, קו מתאר כחלחל עדין (2px, שקיפות נמוכה). "אודות" בצבע בהיר-כחלחל, בצד שמאל (ב-RTL זה `justify-content: space-between` כשהכותרת ראשונה ב-DOM).

**לוח המשחק:**
- מעטפת: `aspect-ratio: 1`, `width: 100%` (עם הגבלת רוחב סבירה), `border-radius: 50%`, רקע Graphite, padding קטן ושכבת הצללה/קו הבהרה עדינים — יוצרת את הטבעת הכהה.
- בתוכה `display: grid` של 2×2 עם `gap` שיוצר את הצלב הכהה.
- **מיקומים קבועים, לא תלויים ב-RTL:** הגריד מוגדר עם `direction: ltr` ו-`grid-template-areas` מפורש: שמאל-למעלה אדום, ימין-למעלה כחול, שמאל-למטה ירוק, ימין-למטה צהוב.
- צורת מקטע: כל `pad` מקבל `border-radius` גדול (100%) בפינה החיצונית בלבד ורדיוס קטן (~12px) בשלוש האחרות — כך מתקבל רבע עיגול עם קשת חיצונית קמורה וקצוות פנימיים כמעט ישרים, וכל הארבעה יחד יוצרים עיגול. לא אריחים מרובעים.
- מצב **Rest** בלבד: Gradient מתון מהצבע הבסיסי (מרכז מעט בהיר), קו הבהרה פנימי (`inset box-shadow`) וצל רך. אין Halo.
- התווית ממורכזת במקטע ומוזזת מעט לכיוון מרכז הגרף כמו ב-Mockup, צבע כהה (`#070B26`), גדולה ומודגשת (כ-28–32px, יחסית לגודל המקטע).
- מצב **Lit** לא ממומש עדיין (Milestone 2), אבל ה-CSS בנוי כך שיהיה קל להוסיף מחלקת `is-lit`.

**כפתורים:**
- Primary "התחל": רוחב מלא, רקע `--blue`, טקסט כהה 18/700, רדיוס 16px, הבהרת שוליים עדינה (glow קל כמו ב-Mockup), גובה ≥ 48px (בפועל ~56–64px).
- Secondary "חזרה למשחק": רוחב מלא, רקע Graphite, טקסט בהיר, קו מתאר 2px בהיר-כחלחל, רדיוס 16px, גובה ≥ 48px.
- כפתור הטקסט "אודות": אזור מגע ≥ 48×48px (padding), גם אם הטקסט קטן.
- Focus: `:focus-visible` עם טבעת בולטת בהירה (2–3px, offset) על כל כפתור, כולל המקטעים. לא מסירים outline בלי חלופה.

**כרטיס תוצאה:** רקע Graphite, רדיוס 20px, קו מתאר 2px עדין, טקסט ממורכז; כותרת 20/700.

## 6. מצב "התחל" והמקטעים לא פעילים ב-Milestone 1

- "התחל" וארבעת המקטעים מקבלים את המאפיין `disabled` — לחיצה לא עושה כלום, ואין להם Focus. המראה נשאר כמו ב-Mockup (ללא אפור/שקיפות), כדי שהבדיקה החזותית תשקף את העיצוב הסופי.
- **החלטת מימוש חדשה (לאישור):** בכרטיס התוצאה במצב ללא תוצאה יוצג הנוסח **"עדיין אין תוצאה"** בצבע הטקסט המשני, במקום "7 מתוך 10". הנוסח אינו מוגדר במקורות (ה-PRD מגדיר רק את ההתנהגות כהנחה). ב-Milestone 1 הכרטיס תמיד במצב זה; קריאת התוצאה האמיתית מגיעה ב-Milestone 2.

## 7. בדיקות

**Vitest (`tests/unit/navigation.test.ts`):** מצב התחלתי `home`; מעבר ל-`about` ובחזרה. מטרתה בעיקר להקים את התשתית; בדיקות המשחק האמיתיות יגיעו ב-Milestone 2.

**Playwright (`tests/e2e/navigation.spec.ts`):** מול `vite build` + `vite preview` (כמו בייצור), בתצוגת מובייל (למשל iPhone 13 / Pixel 7), ב-Chromium וב-WebKit:
1. בטעינה: כותרת "סיימון", טקסט התיאור, ארבעת המקטעים בשמותיהם, "התחל" מוצג ומושבת; מסך האודות מוסתר.
2. לחיצה על "אודות" → כותרת "אודות", "איך משחקים?", חמש ההוראות, "תוצאת המשחק האחרון" + "עדיין אין תוצאה"; הטקסט "7 מתוך 10" **לא** מופיע; הבית מוסתר.
3. "חזרה למשחק" → הבית חוזר.
4. **ללא טעינה מחדש:** מסמנים משתנה על `window` לפני הניווט ובודקים שהוא עדיין קיים אחריו.
5. **רענון:** עוברים לאודות, מבצעים `reload` → הבית מוצג.
6. **מיקומי צבעים:** לפי `boundingBox` — אדום שמאל-למעלה, כחול ימין-למעלה, ירוק שמאל-למטה, צהוב ימין-למטה.
7. **לוח עגול 1:1:** רוחב וגובה הלוח שווים.
8. **אין גלילה אופקית:** `scrollWidth <= clientWidth` בשני המסכים, ברוחב 320px וברוחב 390px.
9. **אין Focus על מסך מוסתר:** Tab בבית לא מגיע לכפתורי האודות, ולהפך.
10. **אין בקשות חיצוניות:** כל בקשות הרשת בטעינה הן ל-origin המקומי.

**CI (`.github/workflows/ci.yml`):**
- מופעל ב-`pull_request` וב-`push` ל-`main`.
- שלבים: checkout → setup-node לפי `.nvmrc` עם cache של npm → `npm ci` → `npm run typecheck` → `npm test` → `npm run build` → `npx playwright install --with-deps chromium webkit` → `npm run test:e2e`.
- Actions נעולים ל-Commit SHA מלא (עם הערה של מספר הגרסה), הרשאות `contents: read` בלבד.
- **אין שלב פריסה** — Pages מגיע ב-Milestone 5.

## 8. ADRs להוספה ל-ARCHITECTURE.md

- **ADR-1: גופן Heebo מקומי דרך `@fontsource/heebo`** — קובצי הגופן נארזים ב-Build ונשמרים עם האתר, ללא Google Fonts/CDN; מאפשר Precache ב-Milestone 4.
- **ADR-2: נתיב בסיס `/simon/` מההתחלה** — התאמה ל-GitHub Pages כבר בפיתוח, כדי לא לגלות בעיות נתיבים רק בפריסה.
- **ADR-3: החלפת מסכים באמצעות `hidden` ומעבר Focus לכותרת** — שני המסכים ב-DOM, המוסתר מחוץ ל-Tab order ולעץ הנגישות.

## 9. אימות בסוף הבנייה (על ידי)

1. `npm ci` נקי (אחרי מחיקת `node_modules`), `npm run typecheck`, `npm run build` — עוברים.
2. `npm test` ו-`npm run test:e2e` — עוברים.
3. בדיקה חזותית בדפדפן המובנה ברוחבים 320, 375 ו-390 של שני המסכים, והשוואה ל-`mockups.png`: צורת הלוח, מיקומי הצבעים, צבעים, גופן, כפתורים, Header וכרטיס. בדיקת Focus במקלדת.
4. בדיקה שבלשונית Network אין בקשות לדומיינים חיצוניים.
5. סגירת כל שרת שהופעל.
6. סימון 🟡 ליד Milestone 1 ב-MILESTONES.md, עדכון "פקודות הרצה" ב-CLAUDE.md, הוספת ה-ADRs.

**מה לא ניתן לאמת לפני דחיפה:** תנאי ה-DoD "ה-CI מריץ את הבדיקות בהצלחה" ייבדק רק אחרי הדחיפה ל-GitHub (בשלב "דחיפה", באישורך). ה-CI יורץ ויוצג אז; אם ייכשל — יתוקן לפני סימון ✅.

## 10. מחוץ לטווח ב-Milestone זה

מנוע משחק, הארת מקטעים, צלילים, Local Storage, הודעות סיום ו"שחקו שוב" (Milestone 2); השהיה ומחזור חיי מכשיר (Milestone 3); Manifest, Service Worker ו-Offline (Milestone 4); GitHub Pages ופריסה (Milestone 5). אין commit או push בשלב הבנייה.
