# Plan — Use Shutap logo SVGs in the UI

## 1. Upload SVGs as Lovable CDN assets
Create `.asset.json` pointers (no binaries in repo) for the three files we'll actually use in the UI:
- `src/assets/shutap-icon.svg.asset.json` (icon mark for nav + favicon)
- `src/assets/shutap-logo-dark.svg.asset.json` (full logo on dark bg — current theme)
- `src/assets/shutap-app-icon.svg.asset.json` (square 512×512 for apple-touch-icon)

Skip the light/wordmark variants for now (the app is dark-themed); they can be added later if needed.

## 2. Replace the `👀` placeholder mark
Two spots currently use a gradient div + 👀 emoji + `{t("appName")}` text:
- **`src/components/nav/PrimaryNav.tsx`** (line 65–70): swap for `<img src={iconAsset.url}>` on mobile, full `shutap-logo-dark.svg` on `sm:` and up. Drop the emoji + text span (wordmark already contains "shutap").
- **`src/routes/index.tsx`** TopBar (line 91–96): same swap.

Sizing: ~28px tall to match current `h-7` chip.

## 3. Favicon + apple-touch-icon
In **`src/routes/__root.tsx`** `head().links`, add:
- `{ rel: "icon", type: "image/svg+xml", href: iconAsset.url }`
- `{ rel: "apple-touch-icon", href: appIconAsset.url }`

## 4. Out of scope
- No design-token changes (the brand pinks already harmonize with the existing primary/accent).
- No changes to share cards, scan/court route headers, or auth screens — those don't render a logo today.
- No Sora font import — wordmark SVGs embed text as `<text>` referencing system Sora; if it's not loaded it falls back. We can add Google Fonts Sora in a follow-up if you want the wordmark to render identically on every device. (Tell me if you want it included now.)

## Files touched
- new: `src/assets/shutap-icon.svg.asset.json`, `src/assets/shutap-logo-dark.svg.asset.json`, `src/assets/shutap-app-icon.svg.asset.json`
- edit: `src/components/nav/PrimaryNav.tsx`, `src/routes/index.tsx`, `src/routes/__root.tsx`
