import os
import subprocess
import sys

from multiprocessing import Process, set_start_method
from dotenv import load_dotenv

from backend.arena import launch_arena
from backend.verifier import launch_verifier
from backend.logger_process import start_process

set_start_method('spawn', True)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
LOGS_DIR = os.path.join(BASE_DIR, "logs")


def run_flask_cmd(*args: str) -> None:
    """Execute Flask command (migrations, seed)."""
    subprocess.run(
        [sys.executable, "-m", "flask",
         "--app", "backend.app:create_app", *args],
        cwd=BASE_DIR,
        check=True,
    )


if __name__ == '__main__':
    load_dotenv(f'{BASE_DIR}/.env')

    os.chdir(BASE_DIR)
    os.makedirs(LOGS_DIR, exist_ok=True)

    file_and_channels = {
        f"{LOGS_DIR}/flask.log": ["ABYSS_FLASK_LOGS"],
        f"{LOGS_DIR}/error_flask.log": ["ABYSS_FLASK_ERRORS"],
        f"{LOGS_DIR}/arena.log": ["ABYSS_ARENA_LOGS"],
        f"{LOGS_DIR}/error_arena.log": ["ABYSS_ARENA_ERRORS"],
        f"{LOGS_DIR}/verifier.log": ["ABYSS_VERIFIER_LOGS"],
        f"{LOGS_DIR}/error_verifier.log": ["ABYSS_VERIFIER_ERRORS"],
    }

    # 1. Init logger process first
    logger_process = Process(target=start_process,
                             name="Abyss Logger",
                             args=[file_and_channels])
    logger_process.start()

    # 2. Schemas and initial data (once)
    run_flask_cmd("db", "upgrade")
    run_flask_cmd("seed")

    # 3. Autonomous services
    flask_port = os.environ.get("VITE_FLASK_PORT", "5555")
    workers_nb = os.environ.get("FLASK_WORKERS_NB", "1")

    processes = {
        "flask": Process(
            target=subprocess.run,
            name="Abyss Flask app",
            args=[["gunicorn", "-w", workers_nb, "--timeout", "300",
                   "-b", "0.0.0.0:" + flask_port,
                   "backend.app:create_app()"]],
            daemon=True),
        "arena": Process(target=launch_arena,
                         name="Abyss Arena",
                         args=[BASE_DIR],
                         daemon=True),
        "verifier": Process(target=launch_verifier,
                            name="Abyss Verifier",
                            args=[BASE_DIR],
                            daemon=True),
    }

    for process in processes.values():
        process.start()

    try:
        for process in processes.values():
            process.join()
    except KeyboardInterrupt:
        for process in processes.values():
            process.terminate()
        logger_process.terminate()
        raise
