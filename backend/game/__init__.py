"""Public API of the game bundle loader."""

from backend.game.manifest import (
    DEFAULT_AGENT_ENTRY,
    DEFAULT_ARGS_MATCH,
    DEFAULT_ARGS_VERIFY,
    GameManifest,
    ManifestError,
    StatSpec,
    load_manifest,
)

__all__ = [
    "DEFAULT_AGENT_ENTRY",
    "DEFAULT_ARGS_MATCH",
    "DEFAULT_ARGS_VERIFY",
    "GameManifest",
    "ManifestError",
    "StatSpec",
    "load_manifest",
]
