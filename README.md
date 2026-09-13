# Gangplank ARAM: Mayhem Desk

A GitHub Pages-friendly companion that refreshes its ARAM: Mayhem data directly from OP.GG.

## Live refresh

The included GitHub Action fetches OP.GG for every champion every six hours and commits a small `data/catalog.js` index plus one lazy-loaded record per champion under `data/champions/`. You can also run it manually from the Actions tab, or run `npm run refresh` locally to refresh Gangplank only.

GitHub Pages cannot request OP.GG directly from the browser because OP.GG does not provide cross-origin access. The action makes the live data available from the same GitHub Pages origin. The site itself has no build step; set Pages to deploy from the repository root on your selected branch.

## GitHub setup

1. Create a GitHub repository and push this folder to its default branch.
2. In **Settings → Actions → General**, set **Workflow permissions** to **Read and write permissions**.
3. In **Settings → Pages**, deploy from the default branch and repository root.
4. Open **Actions → Refresh OP.GG data** and run it once. That first run builds the full champion selector; after that, GitHub refreshes the catalog every six hours without needing your computer.

If the repository uses branch protection, allow the GitHub Actions bot to push its generated `data/live.js` update.
