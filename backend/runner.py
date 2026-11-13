#!/usr/bin/env python3
"""
Generic Abyss game runner.

Mounted read-only at /opt/abyss/runner.py.
The game bundle is mounted at /game:ro;
all build and runtime artifacts go to /run:rw.
"""

from __future__ import annotations

import json
import os
import shutil
import signal
import subprocess
import sys
from pathlib import Path

MANIFEST_FILENAME = "game.json"
RESULT_FILENAME = "runner.json"
RUNNER_LOG = "runner.log"


def _log(run_dir: Path, message: str) -> None:
    # runner.log survives post_play_env
    with (run_dir / RUNNER_LOG).open("a", encoding="utf-8") as f:
        f.write(message + "\n")


def _write_result(run_dir: Path, payload: dict) -> None:
    # machine-readable result for diagnostics
    (run_dir / RESULT_FILENAME).write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _players() -> list[str]:
    # read PLAYERS_JSON, convert to PLAYER_1..n.
    raw = os.environ.get("PLAYERS_JSON")
    if raw:
        try:
            players = json.loads(raw)
        except ValueError as exc:
            raise RuntimeError(f"Invalid PLAYERS_JSON: {exc}") from exc
        if not isinstance(players, list) or not all(
                isinstance(p, str) for p in players):
            raise RuntimeError("PLAYERS_JSON must be a JSON list of strings")
        if players:
            return players

    players = []
    index = 1
    while f"PLAYER_{index}" in os.environ:
        players.append(os.environ[f"PLAYER_{index}"])
        index += 1
    if not players:
        raise RuntimeError("No players provided")
    return players


def _expand(template: list[str], *, port: str, log_path: Path,
            players: list[str]) -> list[str]:
    # {players} expands to several argv items.
    result = []
    for item in template:
        if item == "{players}":
            result.extend(players)
        elif item == "{player}":
            if len(players) != 1:
                raise RuntimeError("{player} requires exactly one player")
            result.append(players[0])
        else:
            result.append(
                item.replace("{port}", port)
                .replace("{log}", str(log_path)))
    return result


def _pip(venv_python: Path, args: list[str], log_path: Path) -> int:
    # keep pip output in a file for the verifier.
    with log_path.open("ab") as log:
        completed = subprocess.run(
            [str(venv_python), "-m", "pip", *args],
            stdout=log,
            stderr=subprocess.STDOUT,
            check=False,
        )
    return completed.returncode


def main() -> int:
    game_dir = Path(os.environ.get("GAME_DIR", "/game"))
    run_dir = Path(os.environ.get("RUN_DIR", "/run"))
    mode = os.environ.get("MODE", "match")
    port = os.environ.get("PORT", "16001")

    run_dir.mkdir(parents=True, exist_ok=True)
    _log(run_dir, f"--- runner mode={mode} ---")

    result = {"mode": mode}
    try:
        if mode not in {"match", "verify"}:
            raise RuntimeError(f"Unknown MODE: {mode}")

        players = _players()
        result["players"] = players

        manifest_path = game_dir / MANIFEST_FILENAME
        if not manifest_path.is_file():
            raise RuntimeError(f"Manifest not found: {manifest_path}")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        launcher = manifest["launcher"]

        log_name = "-".join(players)
        log_path = run_dir / f"{log_name}.log"

        # --- venv and platform dependencies --------------------------------
        venv_dir = run_dir / "venv"
        shutil.rmtree(venv_dir, ignore_errors=True)
        subprocess.run(
            [sys.executable, "-m", "venv", str(venv_dir)],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        venv_python = venv_dir / "bin" / "python"

        stage = "platform_deps"
        platform_log = run_dir / "pip_platform.log"
        code = _pip(venv_python, ["install", "--upgrade", "pip", "-q"],
                    platform_log)
        if code != 0:
            raise RuntimeError("pip upgrade failed")

        # The manifest range is passed to pip, so an incompatible Seahorse
        # installation fails before the game starts.
        seahorse_req = "seahorse" + (manifest.get("seahorse") or "")
        code = _pip(
            venv_python,
            ["install", seahorse_req, "-q"],
            platform_log,
        )
        if code != 0:
            raise RuntimeError("Platform dependencies installation failed")

        # Freeze platform versions so the game cannot silently change them.
        platform_constraints = run_dir / "platform-constraints.txt"
        with platform_constraints.open("w", encoding="utf-8") as f:
            subprocess.run(
                [str(venv_python), "-m", "pip", "freeze"],
                stdout=f,
                check=False,
            )

        # --- game dependencies --------------------------------------------
        stage = "game_deps"
        game_requirements = game_dir / "requirements.txt"
        if game_requirements.is_file():
            code = _pip(
                venv_python,
                ["install", "-r", str(game_requirements),
                 "-c", str(platform_constraints)],
                run_dir / "game_pip.log",
            )
            (run_dir / "code_game_pip.log").write_text(
                str(code), encoding="utf-8")
            if code != 0:
                raise RuntimeError("Game requirements installation failed")

        # Freeze game versions so agents cannot silently change them.
        game_constraints = run_dir / "game-constraints.txt"
        with game_constraints.open("w", encoding="utf-8") as f:
            subprocess.run(
                [str(venv_python), "-m", "pip", "freeze"],
                stdout=f,
                check=False,
            )

        # --- agent dependencies -------------------------------------------
        stage = "agent_deps"
        agent_requirements = run_dir / "requirements.txt"
        if agent_requirements.is_file() and agent_requirements.stat().st_size:
            code = _pip(
                venv_python,
                ["install", "-r", str(agent_requirements),
                 "-c", str(game_constraints)],
                run_dir / f"pip_{log_name}.log",
            )
            (run_dir / f"code_pip_{log_name}.log").write_text(
                str(code), encoding="utf-8")
            if code != 0:
                raise RuntimeError("Agent requirements installation failed")

        # --- check dependencies -------------------------------------------
        stage = "dependency_check"
        check = _pip(venv_python, ["check"], run_dir / "pip_check.log")
        if check != 0:
            raise RuntimeError(
                "Dependency check failed after agent install")

        # --- game process --------------------------------------------------
        stage = "run"
        launcher_entry = game_dir / launcher["entry"]
        if not launcher_entry.is_file():
            raise RuntimeError(f"Launcher not found: {launcher_entry}")

        timeout_key = f"timeout_{mode}"
        if timeout_key not in launcher:
            raise RuntimeError(f"launcher.{timeout_key} is required")

        timeout = int(launcher[timeout_key])
        if timeout <= 0:
            raise RuntimeError(
                f"launcher.{timeout_key} must be a positive integer (seconds)")

        args_template = launcher.get(
            f"args_{mode}",
            (["-p", "{port}", "-f", "{log}", "-t", "local", "{players}"]
             if mode == "match" else
             ["-p", "{port}", "-f", "{log}", "-t", "verify", "{player}"]),
        )
        game_args = _expand(
            args_template, port=port, log_path=log_path, players=players)
        argv = [str(venv_python), str(launcher_entry), *game_args]

        env = os.environ.copy()
        env["PYTHONPATH"] = f"{game_dir}:{run_dir}"
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        env["PYTHONUNBUFFERED"] = "1"

        timed_out = False
        exit_code = 1
        with (run_dir / RUNNER_LOG).open("ab") as runner_log:
            process = subprocess.Popen(
                argv,
                cwd=str(run_dir),
                env=env,
                stdout=runner_log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
            try:
                exit_code = process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
                exit_code = 124
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait()

        # get_record and get_error_verify_log expect this exact file.
        (run_dir / f"timeout_{log_name}.log").write_text(
            str(124 if timed_out else 0), encoding="utf-8")

        result.update({
            "stage": stage,
            "exit_code": exit_code,
            "timed_out": timed_out,
            "log": log_path.name,
        })
        _write_result(run_dir, result)
        return exit_code

    except Exception as exc:
        result.update({"error": str(exc)})
        _log(run_dir, f"ERROR: {exc}")
        _write_result(run_dir, result)
        return 2


if __name__ == "__main__":
    sys.exit(main())
