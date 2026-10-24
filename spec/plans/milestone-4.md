# תוכנית Milestone 4 - שימוש Offline ו-PWA

מבוסס על: PRD (סעיף 4.5 - PWA ושימוש Offline, וטבלת מקרי הקצה: פתיחה ראשונה ללא אינטרנט), ARCHITECTURE (סעיף 5 - PWA, Offline ועדכונים; סעיף 8 - אימות; ADR-1, ADR-2) ו-MILESTONES (Milestone 4).
נקודת המוצא: הקוד הקיים מ-Milestone 3. `base: '/simon/'` כבר מוגדר (ADR-2), הגופן מקומי (ADR-1), והשמע נוצר ב-Web Audio ללא קבצים (ADR-7). אין עדיין Manifest, אייקונים או Service Worker.

## 1. מה נבנה

- **Manifest:** שם ״סיימון״, `lang: he`, `dir: rtl`, `display: standalone`, צבעי רקע ונושא לפי DESIGN, ונתיבי `id`/`start_url`/`scope` = `/simon/`.
- **אייקונים:** 192, 512, גרסת Maskable ב-512, ו-Apple Touch Icon ב-180, מקובץ מקור SVG אחד.
- **Service Worker:** נוצר ב-Build באמצעות `vite-plugin-pwa` (אסטרטגיית `generateSW`, Workbox). Precache לכל משאבי ההרצה: HTML, JS, CSS, Manifest, אייקונים וקובצי הגופן.
- **רישום ועדכון:** רישום Service Worker בעליית הדף, במצב `prompt` — **בלי** Dialog, בלי `skipWaiting`/`clientsClaim`, בלי Reload ובלי קריאה ל-`updateSW()`. גרסה חדשה ממתינה עד שכל הלשוניות הישנות נסגרות.
- **פיתוח:** ה-Service Worker כבוי ב-`npm run dev`; פועל רק ב-Production Build.
- **בדיקות PWA** מול Build אמיתי המוגש מקומית, ב-Chromium עם Service Workers פעילים.

**ללא שינוי בממשק:** אין מסך, כפתור, Dialog או הודעה חדשים. בפרט — **אין הודעה כמו ״מוכן לשימוש Offline״**, כדי שלא תוצג הבטחה שגויה (DoD). אין מסך התקנה; ההתקנה דרך מנגנון הדפדפן בלבד (ARCHITECTURE 5.1).

**לא נכלל:** פריסה ל-GitHub Pages, HTTPS ובדיקת התקנה בטלפונים אמיתיים (Milestone 5).

## 2. תלויות חדשות (גרסאות מדויקות ב-Lockfile)

| חבילה | סוג | סיבה |
| --- | --- | --- |
| `vite-plugin-pwa` 2.0.0 | dev | יצירת Manifest ו-Service Worker (ARCHITECTURE 1) |
| `workbox-window` 7.x (7.4.1 ומעלה בענף 7) | dependency | נדרש לרישום ה-Service Worker מתוך הדף (`virtual:pwa-register`) |
| `workbox-build` 7.x | dev | Peer dependency של התוסף; יותקן אם npm לא מתקין אותו אוטומטית |

אין תלות נוספת. אין `@vite-pwa/assets-generator` (ראה סעיף 4).

## 3. קבצים

### חדשים

| קובץ | תפקיד |
| --- | --- |
| `public/icons/icon.svg` | מקור האייקון: לוח עגול בארבעת הצבעים על רקע Midnight Navy (ראה סעיף 4). |
| `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180) | אייקונים מוכנים, נשמרים ב-Repository. |
| `public/favicon.svg` | עותק של האייקון לשונית הדפדפן (כרגע אין Favicon, והדפדפן מבקש `/favicon.ico` ומקבל 404). |
| `src/pwa.ts` | רישום ה-Service Worker בלבד (מודול ״PWA Registration״ ב-ARCHITECTURE 2.1). ללא גישה למצב המשחק. |
| `tests/e2e/pwa/offline.spec.ts` | Offline, Scope, בקשות חיצוניות, מחיקת נתוני אתר. |
| `tests/e2e/pwa/update.spec.ts` | שתי גרסאות Build וכשל בהכנת Cache. |
| `tests/e2e/pwa/static-server.ts` | שרת סטטי זעיר (Node `http`, ללא תלות) שאפשר להחליף את התיקייה שהוא מגיש ולגרום לו להחזיר שגיאה לקובץ מסוים — לבדיקות העדכון והכשל. |

### משתנים

| קובץ | שינוי |
| --- | --- |
| `package.json`, `package-lock.json` | התלויות מסעיף 2. |
| `vite.config.ts` | הוספת `VitePWA(...)` (סעיף 5); `define` של מזהה Build (סעיף 7.3). |
| `index.html` | `<link rel="icon">`, `<link rel="apple-touch-icon">`. (תגית ה-Manifest מוזרקת אוטומטית ע״י התוסף.) |
| `src/main.ts` | קריאה ל-`registerPwa()` מתוך `src/pwa.ts`; סימון מזהה ה-Build על `<html data-build>`. |
| `tsconfig.json` | הוספת `vite-plugin-pwa/client` ל-`types` (טיפוסי `virtual:pwa-register`). |
| `playwright.config.ts` | פרויקט חדש `chromium-pwa` שמריץ רק את `tests/e2e/pwa/`; שני הפרויקטים הקיימים מתעלמים מהתיקייה הזו. |
| `.gitignore` | הוספת `dist-*/` (תיקיות Build זמניות של בדיקות העדכון). |
| `spec/ARCHITECTURE.md` | ADR-12 עד ADR-14 (סעיף 9). |
| `spec/MILESTONES.md` | סימון 🟡 בסיום הבנייה. |
| `CLAUDE.md` (פקודות הרצה) | הערה ש-PWA נבדק רק מול Build (`npm run build && npm run preview`). |

אין שינוי בלוגיקת המשחק (`controller`, `engine`, `sequence-player`, `audio`, `storage`, `view`, `navigation`, `lifecycle`) או ב-CSS.

## 4. אייקון — החלטת מימוש

עיצוב אייקון לא הוגדר ב-DESIGN או בתמונות. לפי כלל 8 ב-MILESTONES, ההשלמה תהיה מינימלית ותסומן כהחלטת מימוש לבדיקת המשתמש:
- לוח עגול בארבעה רבעים בצבעי המשחק ובמיקומים הקבועים שלהם (אדום, כחול, ירוק, צהוב כמו בלוח), עם מרווח כהה ביניהם, על רקע `#070B26`. ללא טקסט.
- בגרסת Maskable הלוח מוקטן לאזור הבטוח (כ-80% מרכזיים), כדי שלא ייחתך בעיגול/ריבוע של Android.
- יצירת קובצי ה-PNG מה-SVG נעשית **פעם אחת** בזמן הבנייה, באמצעות Playwright שכבר מותקן (סקריפט זמני מחוץ לפרויקט). קובצי ה-PNG נשמרים ב-Repository; אין שלב יצירת אייקונים ב-Build.

## 5. הגדרות `vite-plugin-pwa` (ב-`vite.config.ts`)

```
VitePWA({
  strategies: 'generateSW',
  registerType: 'prompt',
  injectRegister: false,          // registration is done in src/pwa.ts
  devOptions: { enabled: false }, // no SW in `npm run dev`
  includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
  manifest: {
    id: '/simon/', start_url: '/simon/', scope: '/simon/',
    name: 'סיימון', short_name: 'סיימון',
    description: 'סיימון – משחק זיכרון עם אורות וצלילים',
    lang: 'he', dir: 'rtl', display: 'standalone',
    background_color: '#070B26', theme_color: '#070B26',
    icons: [192, 512, maskable 512],
  },
  workbox: {
    globPatterns: ['**/*.{html,js,css,svg,png,woff2,webmanifest}'],
    cleanupOutdatedCaches: true,
    skipWaiting: false,
    clientsClaim: false,
    navigateFallback: 'index.html',
  },
})
```

- **נתיבים:** התוסף משתמש ב-`base` (`/simon/`), ולכן `sw.js` יוגש ב-`/simon/sw.js` וה-Scope יהיה `/simon/` — ה-Service Worker לא ישלוט מחוץ לנתיב הפרויקט.
- **גופן:** `@fontsource/heebo` מפיק קובצי `woff2` ו-`woff` לכל תת-שפה. ה-Precache כולל רק `woff2` (נתמך בכל הדפדפנים הרלוונטיים), כדי לא לשמור קבצים כפולים. בבנייה יש לוודא ברשימת ה-Precache שקובצי העברית והלטינית של 400/700/800 נכללים.
- **ניקוי Cache ישן:** `cleanupOutdatedCaches` מוחק רק Caches של Precache ישן של Workbox באותו Scope. Local Storage לא נגע (ARCHITECTURE 5.3).
- **צלילים:** אין קובצי שמע; אין צורך ב-Runtime caching.

## 6. רישום (`src/pwa.ts`)

```
registerPwa(): void
```
- אם `'serviceWorker' in navigator` אינו נכון — לא עושה כלום (המשחק עובד כרגיל).
- קורא ל-`registerSW({ immediate: true, onRegisterError })` מ-`virtual:pwa-register`.
- **לא** מעביר `onNeedRefresh` שמפעיל משהו, ולא קורא לפונקציית העדכון שמוחזרת — כך גרסה חדשה נשארת Waiting עד סגירת הלשוניות הישנות.
- כשל רישום (`onRegisterError`) נרשם ב-`console.warn` בלבד; לא מוצג למשתמש ולא משפיע על המשחק.
- נקרא ב-`main.ts` אחרי שהמשחק מחובר, כך שכשל בו לא מונע את עליית הממשק.

## 7. בדיקות

### 7.1 Playwright — הגדרה
- פרויקט `chromium-pwa` (Pixel 7, Chromium) עם `testDir`/`testMatch` ל-`tests/e2e/pwa/`, ו-`serviceWorkers: 'allow'` (ברירת המחדל). בלי `page.route` ובלי Mock של Cache. בלי `page.clock` בבדיקות שתלויות ב-Service Worker, כדי לא להפריע להתקנה; במקום זה משחק קצר (הפסד בשלב 1 או 2) מספיק להוכחת משחק, צלילים ושמירה.
- הפרויקטים הקיימים (`chromium-mobile`, `webkit-mobile`) מקבלים `testIgnore: 'pwa/**'` וממשיכים לרוץ מול אותו Build דרך `vite preview`.
- **Offline אמיתי:** `context.setOffline(true)` — חוסם את הרשת לדף ול-Service Worker; הקבצים מגיעים רק מה-Cache.
- **״Precache הושלם״:** ממתינים ל-`navigator.serviceWorker.ready` ולמצב `activated`, ובודקים ב-`caches.keys()` שקיים Cache של Workbox עם כל קובצי ה-Manifest של ה-Precache. לא מסתמכים על `navigator.onLine` (ARCHITECTURE 5.2).

### 7.2 `offline.spec.ts` (מול `vite preview` הקיים, פורט 4173)
1. **Manifest ונתיבים:** קריאת ה-Manifest מה-`<link rel="manifest">` — `id`, `start_url`, `scope` = `/simon/`, `lang`, `dir`, `display`, שם, ושלושת האייקונים נטענים (200, סוג `image/png`, מידות נכונות). Apple Touch Icon ו-Favicon נטענים.
2. **Scope:** `registration.scope` מסתיים ב-`/simon/`; דף בנתיב `http://localhost:4173/` (מחוץ לפרויקט) אינו נשלט (`navigator.serviceWorker.controller === null`).
3. **Offline מלא:** טעינה מקוונת → המתנה ל-Precache → `setOffline(true)` → Reload → הבית מוצג בגופן Heebo (`document.fonts.check`) → משחק עד הפסד (צלילים: AudioContext במצב `running` ונוצרים Oscillators — נבדק בעטיפת `AudioContext.prototype` מתוך הדף, כמו בבדיקות הקודמות) → מעבר לאודות → התוצאה מוצגת → Reload נוסף (עדיין Offline) → התוצאה עדיין באודות.
4. **ללא בקשות חיצוניות:** רישום כל הבקשות בטעינה ובמשחק (`page.on('request')`) — כולן לאותו Origin. (בנוסף לבדיקת ה-CDN הקיימת מ-Milestone 1.)
5. **מחיקת נתוני אתר:** אחרי Precache, מחיקה דרך CDP (`Storage.clearDataForOrigin`: Cache Storage, Service Workers, Local Storage) בזמן שהדף פתוח → המשחק שכבר נטען ממשיך לעבוד עד סיום ואינו קורס (אין `pageerror`); לא מוצגת שום הודעת Offline. טעינה מחדש מקוונת מתקינה שוב את ה-Service Worker.

### 7.3 `update.spec.ts` (שרת סטטי משלו, פורט 4174)
**הכנה:** שני Builds אמיתיים לתיקיות `dist-a/` ו-`dist-b/`, עם `SIMON_BUILD_ID=a` / `=b`. המזהה נכנס לקוד דרך `define` ומסומן על `<html data-build>`, ולכן ה-JS, רשימת ה-Precache ו-`sw.js` שונים בין הגרסאות — עדכון אמיתי, לא שינוי מלאכותי של קובץ. (ברירת המחדל של המזהה היא הגרסה מ-`package.json`.)

1. **הגרסה החדשה ממתינה ואינה קוטעת משחק:**
   - השרת מגיש `dist-a` → טעינה, Precache, Reload כדי שהדף יהיה נשלט, התחלת משחק.
   - השרת מוחלף ל-`dist-b` → `registration.update()` מתוך הדף (מדמה את בדיקת העדכון של הדפדפן).
   - מאומת: `registration.waiting` קיים (גרסה b), `registration.active` עדיין a, הדף לא נטען מחדש (`data-build="a"`, אותו אובייקט `window`), המשחק ממשיך וניתן להשלים שלב/לסיים ולשמור תוצאה; מעבר לאודות עובד.
   - פתיחת לשונית שנייה באותו Context — עדיין `data-build="a"` (הגרסה הישנה עדיין בשימוש).
2. **הפעלה אחרי סגירת ה-Clients הישנים:** סגירת כל הלשוניות → פתיחת לשונית חדשה (ואם נדרש, Reload נוסף אחרי ש-b הופעלה) → `data-build="b"`, `registration.active` היא b, והתוצאה מהשלב הקודם עדיין באודות. Caches ישנים של a נמחקו; המפתח `simon:last-result:v1` נשאר.
3. **כשל בהכנת Cache:** השרת מגיש `dist-a` אבל מחזיר 500 לאחד מקובצי ה-Precache (למשל `icon-512.png`) → ההתקנה נכשלת (אין `registration.active`, אין Cache של Workbox) → המשחק בדף הנוכחי עובד עד סיום ושומר תוצאה, ואין הודעת Offline. `setOffline(true)` + Reload נכשל לטעון — זו ההתנהגות הצפויה (אין הבטחה לפתיחה ללא רשת).

### 7.4 Vitest
אין לוגיקה חדשה שאפשר לבדוק ביחידה בלי Service Worker אמיתי; `src/pwa.ts` הוא עטיפה דקה. כל בדיקות היחידה הקיימות ממשיכות לעבור.

### 7.5 בדיקה ידנית בזמן הבנייה
- `npm run build && npm run preview`, פתיחה בדפדפן המובנה: ב-DevTools (Application) — Manifest ללא שגיאות, Service Worker פעיל ב-Scope `/simon/`, רשימת Precache כוללת גופן ואייקונים.
- `npm run dev` — מאומת שאין Service Worker רשום.
- בדיקת התקנה בטלפון — נדחית ל-Milestone 5 (דורש HTTPS).

### 7.6 כללי
`npm run typecheck`, `npm test`, `npm run test:e2e` (שלושת הפרויקטים), ו-Build — כולם עוברים. ה-CI הקיים מריץ את `test:e2e` ולכן יריץ גם את בדיקות ה-PWA ללא שינוי ב-Workflow (Chromium כבר מותקן בו).

## 8. החלטות מימוש (יוצגו לבדיקת המשתמש)

1. **אייקון** — לוח עגול בארבעת הצבעים על רקע כהה, ללא טקסט (סעיף 4).
2. **אין שום הודעה על מצב Offline או עדכון** — לא ״מוכן ל-Offline״ ולא ״גרסה חדשה זמינה״. העדכון מגיע בשקט בפתיחה הבאה אחרי שכל הלשוניות נסגרו.
3. **צבע רקע/נושא ב-Manifest** — `#070B26` (Midnight Navy), כך שמסך הפתיחה של PWA מותקן תואם לרקע האפליקציה.
4. **Favicon** — נוסף כ-SVG (אותו אייקון), כדי לבטל את בקשת ה-404 לרכיב שלא קיים.

## 9. ADRs להוספה ב-ARCHITECTURE.md

- **ADR-12: הגדרת PWA ב-`vite-plugin-pwa` (`generateSW`, `prompt`) ורישום ידני** — Manifest ו-Scope מתוך `/simon/`; Precache של `woff2` בלבד מהגופן; `injectRegister: false` ורישום ב-`src/pwa.ts` בלי `onNeedRefresh` פעיל, בלי `skipWaiting`/`clientsClaim`; כבוי ב-dev.
- **ADR-13: אייקון ממקור SVG אחד, PNG נשמרים ב-Repository** — עיצוב מינימלי שנגזר מהלוח; יצירה חד-פעמית ב-Playwright; אין שלב יצירה ב-Build.
- **ADR-14: בדיקות PWA מול Build אמיתי עם שרת סטטי מתחלף** — פרויקט Playwright נפרד ב-Chromium; `setOffline` במקום Mock; שני Builds עם מזהה Build שונה דרך `define` ו-`data-build`; CDP למחיקת נתוני אתר. WebKit אינו מריץ בדיקות Service Worker (תמיכה מוגבלת ב-Playwright); אימות iOS במכשיר אמיתי ב-Milestone 5.

## 10. סדר עבודה

1. התקנת התלויות ונעילתן.
2. אייקונים (SVG + PNG) ו-Favicon.
3. `vite.config.ts`, `src/pwa.ts`, `main.ts`, `index.html`, `tsconfig.json`; Build ובדיקה ידנית ברשימת ה-Precache וב-DevTools.
4. וידוא ש-`npm run dev` אינו רושם Service Worker.
5. Playwright: פרויקט `chromium-pwa`, `offline.spec.ts`.
6. השרת הסטטי ו-`update.spec.ts`.
7. הרצת כל הבדיקות (כולל הקיימות ב-Chromium וב-WebKit).
8. ADRs, `.gitignore`, `CLAUDE.md`, מעבר על ה-Definition of Done, סימון 🟡.

## 11. Definition of Done — מיפוי

| תנאי | איך נבדק |
| --- | --- |
| Manifest, אייקונים, `base`, `start_url`, `id`, `scope` תקינים תחת נתיב Repository; SW לא שולט מחוץ לנתיב | `offline.spec.ts` (1, 2) + DevTools |
| אחרי Precache: Offline + Reload ← משחק מלא עם צלילים, אודות, שמירה וקריאה אחרי Reload נוסף | `offline.spec.ts` (3) |
| Playwright Offline מול Build אמיתי עם SW, Chromium, ללא Mock של Cache | פרויקט `chromium-pwa`, `setOffline` |
| אין בקשה חיצונית לטקסט, גופן, לוח או שמע | `offline.spec.ts` (4) + הבדיקה הקיימת |
| שתי גרסאות: החדשה ממתינה, לא קוטעת, מופעלת אחרי סגירת Clients; התוצאה נשמרת | `update.spec.ts` (1, 2) |
| כשל Cache ומחיקת נתוני אתר: בלי הבטחה שגויה, בלי קריסה; אין הבטחה לפתיחה ראשונה Offline | `update.spec.ts` (3) + `offline.spec.ts` (5) + אין הודעת Offline בממשק |
| כל בדיקות המשחק, הניווט, Type checking ו-Build עוברים | הרצה מלאה מקומית |
