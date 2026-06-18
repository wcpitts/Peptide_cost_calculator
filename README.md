# Liberty Blue 2.0 - Peptide Synthesis Request

Static GitHub Pages calculator for preparing preliminary peptide synthesis requests for a Liberty Blue 2.0 workflow. The app runs entirely in the browser with HTML, CSS, and vanilla JavaScript. It does not require React, Node.js, a database, a build step, or a server.

## Major Features

- Peptide sequence parsing for standard one-letter amino-acid codes.
- Terminal group detection for `Ac-`, `H-`, `-OH`, `-NH2`, and `-NH2`-style amide input.
- Amino-acid composition, count, percentage, and position mapping.
- Fmoc protected building-block requirement calculations.
- Standard, double-all, selected-residue, and selected-position double-coupling modes.
- Requester-supplied amino-acid handling with charged cost set to `$0.00`.
- Manual amino-acid mass overrides with reset controls.
- Editable nonstandard amino-acid rows.
- Hematian Lab DMF and pyrrolidine configuration and estimates.
- Preliminary cost panel with amino-acid, reagent, and configurable method charges.
- Local draft save/load/clear using browser `localStorage`.
- Review summary, JSON export, CSV export, and browser print/save-as-PDF support.

## File Structure

```text
index.html
css/styles.css
js/amino-acids.js
js/app.js
README.md
.gitignore
```

## Running Locally

Open `index.html` directly in a modern browser. The app uses relative paths only, so the same files work from local disk and from GitHub Pages.

## Editing Amino-Acid Data And Prices

The standard Fmoc building-block records are in `js/amino-acids.js`. Each entry includes:

- One-letter code
- Amino-acid name
- Protected building-block name
- Molecular formula
- Molecular weight
- Residue mass
- Placeholder price per gram
- Placeholder stock amount

The `pricePerGram` values are demonstration placeholders only. They are not official Hematian Lab prices.

## Configuring DMF And Pyrrolidine Assumptions

Instrument-specific reagent assumptions are read from the internal configuration source. The requester-facing page does not expose these values as editable controls. The source defaults in `js/app.js` are intentionally zero and marked `CONFIGURATION REQUIRED`:

- DMF liters per coupling cycle at 0.10 mmol
- DMF liters per deprotection cycle at 0.10 mmol
- DMF liters per wash at 0.10 mmol
- Pyrrolidine solution liters per deprotection at 0.10 mmol
- DMF price per liter
- Pyrrolidine solution price per liter

Do not treat reagent totals as complete until these values are configured for the actual instrument and local method through the planned administrator/backend workflow or a trusted stored configuration.

## Calculation Formulas

For each protected amino acid:

```text
number of coupling cycles =
normal occurrences + additional double-coupling cycles

required mmol =
synthesis scale in mmol
x equivalents per coupling
x number of coupling cycles
x (1 + overage percentage / 100)

required grams =
required mmol x protected amino-acid molecular weight / 1000

estimated amino-acid cost =
required grams x price per gram
```

Requester-supplied amino acids keep required mmol and grams visible, but charged cost is `$0.00`.

For configured Hematian Lab reagents:

```text
scale factor = synthesis scale / 0.10 mmol

DMF for coupling =
DMF liters per coupling at 0.10 mmol
x total coupling cycles
x scale factor

DMF for deprotection =
DMF liters per deprotection at 0.10 mmol
x total deprotection cycles
x scale factor

DMF for washes =
DMF liters per wash at 0.10 mmol
x wash cycles
x scale factor

Total DMF = coupling DMF + deprotection DMF + wash DMF

Pyrrolidine solution =
pyrrolidine solution liters per deprotection at 0.10 mmol
x total deprotection cycles
x scale factor
```

Wash-attributable DMF and its cost are displayed as a read-only method breakdown. They are already included in Total DMF amount and Total DMF cost, so they are not added again to the preliminary total. Additional double-coupling and contingency charges are configurable manual estimate fields and default to `$0.00`.

## Warnings

Placeholder prices are not official Hematian Lab prices. Reagent configuration values are not official Liberty Blue reagent-consumption values. Final costs must be determined from the approved synthesis method, actual reagent use, and lab-approved pricing.

This app is designed for public static hosting. Do not enter confidential, regulated, export-controlled, proprietary, or sensitive personal information into a public GitHub Pages deployment.

Real request submission, authentication, approval routing, email notifications, user identity, and audit trails require a secure backend. They are intentionally not implemented in this static GitHub Pages version.

## GitHub Pages Deployment

1. Push the repository to GitHub.
2. Open the repository on GitHub.
3. Go to `Settings → Pages → Build and deployment`.
4. Choose `Deploy from a branch`.
5. Set `Branch: main`.
6. Set `Folder: /root`.
7. Save the Pages configuration.

## Proposed Later Backend Integration

A later production version could use Supabase for authenticated submissions, PostgreSQL-backed request records, role-based review status, protected reagent/pricing configuration, file export history, and secure notification workflows. That backend should be designed before collecting real submissions or protected requester data.
