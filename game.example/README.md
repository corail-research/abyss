# Game bundle example

This directory is a template for an Abyss game bundle. Copy it to the
repository root as `game/`:

```bash
cp -r game.example game
```

The real `game/` directory is deployment-specific and is ignored by Git.
Everything needed to define and run the game lives here; do not edit
`src/config.js`, `public/`, or `docker/entrypoint.sh` for a new game.

## Bundle layout

```text
game/
  game.json              # manifest, the single source of truth
  main.py                # Seahorse launcher
  requirements.txt       # game-specific Python dependencies (optional)
  README.md
  gui/                   # the only subtree served to the browser
    index.html           # replay viewer entry point
    rules/
      regles.pdf         # rules download (PDF example)
      rules.txt          # rules download (plain-text example)
      page-fr.svg        # rules page image (SVG example)
      page-en.png        # rules page image (PNG example)
    stats/
      moves.svg          # palmares icon
```

All `gui.entry`, `rules.*` and `stats[].palmares_image` paths are relative to
`game/gui/`. The backend serves `/game/gui/<path>` only: `main.py`,
`requirements.txt` and the rest of the bundle are never exposed.

## Manifest, commented

`game.json` must be **strict JSON**: no comments, no trailing commas. The
version below is annotated for documentation only.

```jsonc
{
  // Manifest format version, not the game version.
  "manifest_version": 1,

  "id": "example-game",          // slug used in logs and archives
  "version": "1.0.0",            // game version

  "name": {
    "fr": "Jeu d'exemple",
    "en": "Example game"
  },
  "description": {
    "fr": "Remplacez cette description.",
    "en": "Replace this description."
  },
  "copyright": {
    "fr": "Lien vers la source ou la licence",
    "en": "Link to the source or license"
  },

  "players": 2,                  // the current arena supports 1v1 only
  "draws": true,                 // empty winners_id is a draw, not a crash
  "seahorse": ">=1.2.6",         // PEP 440 compatibility range

  // Filename expected at the root of every student zip.
  "agent": { "entry": "my_player.py" },

  // Optional; defaults to requirements.txt when present.
  "requirements": "requirements.txt",

  "launcher": {
    "entry": "main.py",
    "timeout_match": 2000,       // seconds
    "timeout_verify": 1000,      // seconds

    // Standard Abyss CLI. These are the defaults; they may be omitted.
    "args_match": [
      "-p", "{port}",
      "-f", "{log}",
      "-t", "local",
      "{players}"
    ],
    "args_verify": [
      "-p", "{port}",
      "-f", "{log}",
      "-t", "verify",
      "{player}"
    ]
  },

  // Relative to game/gui/. This is the only served subtree.
  "gui": { "entry": "index.html" },

  // Also relative to game/gui/.
  "rules": {
    "download": {
      "fr": "rules/regles.pdf",
      "en": "rules/rules.txt"
    },
    "pages": {
      "fr": ["rules/page-fr.svg"],
      "en": ["rules/page-en.png"]
    }
  },

  "stats": [
    {
      // Must match custom_stats.name in the match record.
      "key": "n_moves",
      "title": { "fr": "Coups joués", "en": "Moves played" },
      "description": {
        "fr": "Nombre de coups joués.",
        "en": "Number of moves played."
      },
      "type": "integer",         // only integer is supported for now
      "aggregation": "sum",      // sum | mean | min | max
      "to_maximize": true,
      "in_palmares": true,

      // Relative to game/gui/.
      "palmares_image": "stats/moves.svg"
    }
  ]
}
```

## Schema

`backend/game/manifest.schema.json` validates the manifest shape with
`jsonschema` (draft 2020-12). It checks:

- required fields and JSON types;
- `additionalProperties: false`, so unknown fields are rejected;
- `manifest_version: 1`;
- `id` and `stats[].key` patterns;
- `players >= 2`, positive timeouts;
- `type` and `aggregation` enumerations;
- localized objects `{fr, en}` via `$defs`/`$ref`.

The JSON Schema does not check file existence or path containment:
those checks, plus CLI placeholders, duplicate stat keys and the
Seahorse specifier, are performed by `backend/game/manifest.py`.

Because both files are read with `json.load`, **neither `game.json` nor
`manifest.schema.json` may contain comments**. Keep annotated examples in this
README or in a separate `.jsonc` file that is not loaded.

## Standard launcher CLI

Abyss runs the launcher with these arguments:

```text
python main.py -p PORT -f LOG -t local agent_1 agent_2
python main.py -p PORT -f LOG -t verify agent_1
```

Placeholders available in `args_match` / `args_verify`:

| Placeholder | Meaning |
|---|---|
| `{port}` | Seahorse master port |
| `{log}` | log file expected by Abyss |
| `{players}` | all player module stems (match mode) |
| `{player}` | one player module stem (verify mode) |

`args_match` must contain `{port}`, `{log}` and `{players}`;
`args_verify` must contain `{port}`, `{log}` and `{player}`. The defaults
above can be omitted from the manifest.

## Rules and images

- `rules.download` is served as a download link. Any file type is accepted:
  PDF, TXT, Markdown, HTML, etc. The example uses PDF for French and TXT for
  English.
- `rules.pages` are rendered with `<img>`. Use browser-supported images:
  SVG, PNG, JPG, WebP or GIF. **Do not use PDF here.**
- `stats[].palmares_image` is also rendered as an image; the same formats apply.
- All these paths are relative to `game/gui/`.

## Custom statistics

- `key` must match `custom_stats.name` in the match record. A typo means the
  statistic is silently absent from the UI.
- `value` must be an integer for the current database schema.
- `aggregation` is one of `sum`, `mean`, `min`, `max`.
- `to_maximize` controls palmares ordering; `in_palmares` adds the stat to the
  palmares page.
- `palmares_image` should be provided when `in_palmares` is true; a
  missing image currently produces a validation warning.

## Validate

```bash
flask --app backend.app:create_app check-game --path game
```

`check-game` validates the manifest and every referenced file. It does not run
the game; the runtime integration arrives in a later phase.

## Files in this example

```text
game.example/
  game.json
  main.py
  requirements.txt
  README.md
  gui/
    index.html
    rules/
      regles.pdf
      rules.txt
      page-fr.svg
      page-en.png
    stats/
      moves.svg
```
