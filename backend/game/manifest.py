"""
Load and validate an Abyss game bundle manifest.

The JSON Schema checks the shape. This module adds semantic checks that JSON
Schema cannot express: file existence, path containment, CLI placeholders,
duplicate stats and Seahorse compatibility.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from packaging.specifiers import InvalidSpecifier, SpecifierSet

# --- Bundle layout ---------------------------------------------------------

MANIFEST_FILENAME = "game.json"   # Manifest at the bundle root.
GUI_DIRNAME = "gui"               # Only this subtree will be served.
SCHEMA_PATH = Path(__file__).with_name("manifest.schema.json")

# --- Defaults applied when the manifest omits optional fields -------------

DEFAULT_AGENT_ENTRY = "my_player.py"
DEFAULT_TIMEOUT_MATCH = 2000
DEFAULT_TIMEOUT_VERIFY = 1000
DEFAULT_ARGS_MATCH = (
        "-p", "{port}", "-f", "{log}", "-t", "local", "{players}")
DEFAULT_ARGS_VERIFY = (
        "-p", "{port}", "-f", "{log}", "-t", "verify", "{player}")

# Placeholders accepted in launcher arguments.
_ALLOWED_PLACEHOLDERS = {"port", "log", "players", "player"}
_PLACEHOLDER_RE = re.compile(r"\{([a-z_]+)\}")


class ManifestError(Exception):
    """All validation errors for one game manifest."""

    def __init__(self, errors: list[str]):
        self.errors = list(errors)
        super().__init__("\n".join(self.errors))


@dataclass(frozen=True)
class StatSpec:
    """One custom statistic declared by the game."""

    key: str
    title: dict[str, str]
    description: dict[str, str] | None
    type: str
    aggregation: str
    to_maximize: bool
    in_palmares: bool
    palmares_image: Path | None


@dataclass(frozen=True)
class GameManifest:
    """Validated manifest with resolved absolute paths."""

    root: Path
    id: str
    version: str
    name: dict[str, str]
    description: dict[str, str] | None
    copyright: dict[str, str] | None
    players: int
    draws: bool
    seahorse: str | None
    agent_entry: str
    requirements: Path | None
    launcher_entry: Path
    timeout_match: int
    timeout_verify: int
    args_match: tuple[str, ...]
    args_verify: tuple[str, ...]
    gui_entry: Path
    rules_download: dict[str, Path] | None
    rules_pages: dict[str, tuple[Path, ...]] | None
    stats: tuple[StatSpec, ...]
    warnings: tuple[str, ...] = ()


def _schema() -> dict[str, Any]:
    """Load the JSON Schema from disk."""
    with SCHEMA_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _resolve(base: Path, value: str, label: str,
             errors: list[str]) -> Path | None:
    """Resolve a relative path and require an existing file inside base."""
    rel = Path(value)

    # Reject absolute paths and parent traversal before touching the disk.
    if rel.is_absolute() or ".." in rel.parts:
        errors.append(f"{label}: must be a relative path inside the bundle")
        return None

    full = (base / rel).resolve()
    if not full.is_relative_to(base.resolve()):
        errors.append(f"{label}: path escapes the bundle")
        return None
    if not full.is_file():
        errors.append(f"{label}: file not found: {full}")
        return None
    return full


def _check_args(args: tuple[str, ...], kind: str, required: set[str],
                errors: list[str]) -> None:
    """Validate launcher placeholders for match or verify mode."""
    found: set[str] = set()

    for arg in args:
        for name in _PLACEHOLDER_RE.findall(arg):
            if name not in _ALLOWED_PLACEHOLDERS:
                errors.append(
                    f"launcher.args_{kind}: unknown placeholder {{{name}}}")
            found.add(name)

    # {player} only makes sense in verify mode, {players} in match mode.
    if kind == "match" and "player" in found:
        errors.append("launcher.args_match: {player} is only valid in verify")
    if kind == "verify" and "players" in found:
        errors.append("launcher.args_verify: {players} is only valid in match")

    for name in sorted(required - found):
        errors.append(
            f"launcher.args_{kind}: missing {{{name}}} placeholder")


def load_manifest(game_dir: str | Path) -> GameManifest:
    """Load, validate and resolve a game bundle."""
    root = Path(game_dir).expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []

    # --- Bundle and manifest presence -------------------------------------
    if not root.is_dir():
        raise ManifestError([f"Game directory not found: {root}"])

    manifest_path = root / MANIFEST_FILENAME
    if not manifest_path.is_file():
        raise ManifestError([f"Manifest not found: {manifest_path}"])

    try:
        with manifest_path.open(encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, ValueError) as exc:
        raise ManifestError(
            [f"Cannot read {manifest_path}: {exc}"]) from exc

    if not isinstance(raw, dict):
        raise ManifestError([f"{manifest_path}: expected a JSON object"])

    # --- JSON Schema validation -------------------------------------------
    validator = Draft202012Validator(_schema())
    schema_errors = sorted(
        validator.iter_errors(raw),
        key=lambda e: tuple(str(p) for p in e.absolute_path),
    )
    for error in schema_errors:
        where = ".".join(str(p) for p in error.absolute_path) or "<root>"
        errors.append(f"{where}: {error.message}")

    # Stop here: semantic checks assume required fields are present.
    if errors:
        raise ManifestError(errors)

    # --- Semantic checks ---------------------------------------------------
    gui_base = root / GUI_DIRNAME
    if not gui_base.is_dir():
        errors.append(f"gui/: directory not found in {root}")

    launcher = raw["launcher"]
    launcher_entry = _resolve(
        root, launcher["entry"], "launcher.entry", errors)
    if launcher_entry is not None and launcher_entry.suffix != ".py":
        errors.append("launcher.entry: expected a .py file")

    # requirements.txt is optional; if omitted, use the conventional file.
    requirements: Path | None = None
    if "requirements" in raw:
        requirements = _resolve(
            root, raw["requirements"], "requirements", errors)
    else:
        candidate = root / "requirements.txt"
        requirements = candidate if candidate.is_file() else None

    # All GUI paths are relative to game/gui/.
    gui_entry = _resolve(
        gui_base, raw["gui"]["entry"], "gui.entry", errors)

    rules_download: dict[str, Path] | None = None
    rules_pages: dict[str, tuple[Path, ...]] | None = None
    rules = raw.get("rules")
    if rules:
        if "download" in rules:
            rules_download = {}
            for lang, path in rules["download"].items():
                resolved = _resolve(
                    gui_base, path, f"rules.download.{lang}", errors)
                if resolved is not None:
                    rules_download[lang] = resolved

        if "pages" in rules:
            rules_pages = {}
            for lang, paths in rules["pages"].items():
                resolved_paths = []
                for index, path in enumerate(paths):
                    resolved = _resolve(
                        gui_base, path,
                        f"rules.pages.{lang}[{index}]", errors)
                    if resolved is not None:
                        resolved_paths.append(resolved)
                rules_pages[lang] = tuple(resolved_paths)

    # --- Custom stats ------------------------------------------------------
    stats: list[StatSpec] = []
    seen_keys: set[str] = set()

    for index, stat in enumerate(raw.get("stats", [])):
        key = stat["key"]
        if key in seen_keys:
            errors.append(f"stats[{index}].key: duplicate '{key}'")
        seen_keys.add(key)

        palmares_image: Path | None = None
        if stat.get("palmares_image"):
            palmares_image = _resolve(
                gui_base, stat["palmares_image"],
                f"stats[{index}].palmares_image", errors)

        in_palmares = stat.get("in_palmares", False)
        if in_palmares and palmares_image is None:
            warnings.append(
                f"stats[{index}] ({key}): in_palmares without a valid "
                "palmares_image")

        # CustomStats.value is an Integer in the current database.
        if stat["type"] != "integer":
            errors.append(
                f"stats[{index}].type: only 'integer' is supported "
                "by the current database")

        stats.append(StatSpec(
            key=key,
            title=stat["title"],
            description=stat.get("description"),
            type=stat["type"],
            aggregation=stat["aggregation"],
            to_maximize=stat.get("to_maximize", True),
            in_palmares=in_palmares,
            palmares_image=palmares_image,
        ))

    # --- Launcher arguments ------------------------------------------------
    args_match = tuple(launcher.get("args_match", DEFAULT_ARGS_MATCH))
    args_verify = tuple(launcher.get("args_verify", DEFAULT_ARGS_VERIFY))
    _check_args(args_match, "match", {"port", "log", "players"}, errors)
    _check_args(args_verify, "verify", {"port", "log", "player"}, errors)

    # --- Seahorse compatibility --------------------------------------------
    if "seahorse" not in raw:
        warnings.append(
            "seahorse compatibility is not declared; add a PEP 440 specifier")
    else:
        try:
            SpecifierSet(raw["seahorse"])
        except InvalidSpecifier as exc:
            errors.append(f"seahorse: invalid specifier: {exc}")

    # The current arena is 1v1; this is a warning, not a hard failure.
    if raw["players"] != 2:
        warnings.append(
            "players != 2: the current arena only supports 1v1 matches")

    if errors:
        raise ManifestError(errors)

    assert launcher_entry is not None
    assert gui_entry is not None

    return GameManifest(
        root=root,
        id=raw["id"],
        version=raw["version"],
        name=raw["name"],
        description=raw.get("description"),
        copyright=raw.get("copyright"),
        players=raw["players"],
        draws=raw["draws"],
        seahorse=raw.get("seahorse"),
        agent_entry=(raw.get("agent") or {}).get(
            "entry", DEFAULT_AGENT_ENTRY),
        requirements=requirements,
        launcher_entry=launcher_entry,
        timeout_match=launcher.get("timeout_match", DEFAULT_TIMEOUT_MATCH),
        timeout_verify=launcher.get("timeout_verify", DEFAULT_TIMEOUT_VERIFY),
        args_match=args_match,
        args_verify=args_verify,
        gui_entry=gui_entry,
        rules_download=rules_download,
        rules_pages=rules_pages,
        stats=tuple(stats),
        warnings=tuple(warnings),
    )
