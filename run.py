import os
import subprocess
import sys
import signal
import time

from multiprocessing import Event, Process, set_start_method
from multiprocessing.connection import wait

from dotenv import load_dotenv

from backend.arena import launch_arena
from backend.verifier import launch_verifier
from backend.logger_process import start_process

set_start_method('spawn', True)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
LOGS_DIR = os.path.join(BASE_DIR, "logs")

LOGGER_START_TIMEOUT = 10   # seconds
SHUTDOWN_GRACE_PERIOD = 10  # seconds


def run_flask_cmd(*args: str, timeout: int | None = None) -> None:
    """Run a Flask CLI command from the project directory."""
    """Execute Flask command (migrations, seed)."""
    subprocess.run(
        [sys.executable, "-m", "flask",
         "--app", "backend.app:create_app", *args],
        cwd=BASE_DIR,
        check=True,
        timeout=timeout
    )


def run_gunicorn() -> None:
    """Replace the current process with gunicorn.

    os.execv keeps a single PID: the SIGTERM sent by stop_all() reaches
    gunicorn itself. With subprocess.run() as the target, only the Python
    wrapper would be killed and gunicorn would be left orphaned.
    """

    os.execv(
        sys.executable,
        [sys.executable, "-m", "gunicorn",
         "--config", os.path.join(BASE_DIR, "gunicorn.conf.py"),
         "backend.app:create_app()"],
    )


def wait_for_first_exit(processes: dict[str, Process]) -> tuple[str, int]:
    """Block until one service exits; return its name and exit code."""
    sentinels = {process.sentinel: name for name, process in processes.items()}
    for sentinel in wait(list(sentinels)):
        name = sentinels[sentinel]
        return name, processes[name].exitcode or 1
    return "unknown", 1


def stop_all(processes: dict[str, Process], logger_process: Process) -> None:
    """
    Terminate every child, then kill those still alive after the grace period.
    """
    children = [*processes.values(), logger_process]
    for process in children:
        if process.is_alive():
            process.terminate()

    deadline = time.monotonic() + SHUTDOWN_GRACE_PERIOD
    for process in children:
        process.join(timeout=max(0.0, deadline - time.monotonic()))
        if process.is_alive():
            process.kill()
            process.join()


def handle_sigterm(signum, frame) -> None:
    """Turn SIGTERM into KeyboardInterrupt so the cleanup path always runs."""
    raise KeyboardInterrupt


if __name__ == '__main__':
    load_dotenv(f'{BASE_DIR}/.env')

    os.chdir(BASE_DIR)
    os.makedirs(LOGS_DIR, exist_ok=True)

    signal.signal(signal.SIGTERM, handle_sigterm)

    db_setup_timeout = int(os.environ.get("DB_SETUP_TIMEOUT", "600"))

    file_and_channels = {
        f"{LOGS_DIR}/flask.log": ["ABYSS_FLASK_LOGS"],
        f"{LOGS_DIR}/error_flask.log": ["ABYSS_FLASK_ERRORS"],
        f"{LOGS_DIR}/arena.log": ["ABYSS_ARENA_LOGS"],
        f"{LOGS_DIR}/error_arena.log": ["ABYSS_ARENA_ERRORS"],
        f"{LOGS_DIR}/verifier.log": ["ABYSS_VERIFIER_LOGS"],
        f"{LOGS_DIR}/error_verifier.log": ["ABYSS_VERIFIER_ERRORS"],
    }

    # 1. Init logger process first
    logger_ready = Event()
    logger_process = Process(
            target=start_process,
            name="Abyss Logger",
            args=[file_and_channels],
            daemon=True)
    logger_process.start()

    processes: dict[str, Process] = {}
    exit_code = 0

    try:
        # Redis pub/sub does not buffer: wait until the listeners are
        # subscribed, otherwise the migration and seed logs are lost.
        if not logger_ready.wait(timeout=LOGGER_START_TIMEOUT):
            raise RuntimeError(
                f"Logger not ready after {LOGGER_START_TIMEOUT}s")

        # 2. Schemas and initial data (once)
        run_flask_cmd("db-setup")
        run_flask_cmd("seed")

        # 3. Autonomous services
        processes = {
            "flask": Process(
                target=subprocess.run,
                name="Abyss Flask app",
                args=[[sys.executable, "-m", "gunicorn",
                       "--config", os.path.join(BASE_DIR, "gunicorn.conf.py"),
                       "backend.app:create_app()"]],
                daemon=True),
            "arena": Process(
                target=launch_arena,
                name="Abyss Arena",
                args=[BASE_DIR],
                daemon=True),
            "verifier": Process(
                target=launch_verifier,
                name="Abyss Verifier",
                args=[BASE_DIR],
                daemon=True),
        }

        for process in processes.values():
            process.start()

        # Fail fast: one dead service stops the stack
        name, code = wait_for_first_exit(processes)
        print(f"{name} exited with code {code}; shutting down.",
              file=sys.stderr)
        exit_code = code if code and code > 0 else 1

    except KeyboardInterrupt:
        print("Interrupted; shutting down.", file=sys.stderr)
        exit_code = 130
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        print(f"Startup failed: {error}", file=sys.stderr)
        exit_code = 1
    finally:
        stop_all(processes, logger_process)

    sys.exit(exit_code)
