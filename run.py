import os
import subprocess

from multiprocessing import Process, set_start_method
from dotenv import load_dotenv

from backend.arena import launch_arena
from backend.verifier import launch_verifier
from backend.logger_process import start_process
from backend.utils.manager import AbyssManager

set_start_method('spawn', True)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
LOGS_DIR = os.path.join(BASE_DIR, "logs")

if __name__ == '__main__':
    load_dotenv(f'{BASE_DIR}/.env')

    os.chdir(BASE_DIR)
    if not os.path.exists(LOGS_DIR):
        os.mkdir(LOGS_DIR)

    manager = AbyssManager(('', int(os.environ.get("ABYSS_MANAGER_PORT", 50000))), authkey=eval(os.environ.get("ABYSS_MANAGER_AUTHKEY", "b'abracadabra'")))
    manager.start()
    logger_state = manager.logger_state()
    flask_state = manager.flask_state()
    arena_state = manager.arena_state()

    file_and_channels = {
        f"{LOGS_DIR}/flask.log": ["ABYSS_FLASK_LOGS"],
        f"{LOGS_DIR}/error_flask.log": ["ABYSS_FLASK_ERRORS"],
        f"{LOGS_DIR}/arena.log": ["ABYSS_ARENA_LOGS"],
        f"{LOGS_DIR}/error_arena.log": ["ABYSS_ARENA_ERRORS"],
        f"{LOGS_DIR}/verifier.log": ["ABYSS_VERIFIER_LOGS"],
        f"{LOGS_DIR}/error_verifier.log": ["ABYSS_VERIFIER_ERRORS"],
    }

    logger_process = Process(target=start_process,
                             name="Abyss Logger",
                             args=[file_and_channels])
    logger_process.start()

    flask_port = os.environ.get("VITE_FLASK_PORT", "5555")
    workers_nb = os.environ.get("FLASK_WORKERS_NB", "1")

    flask_app = Process(target=subprocess.run,
                        name="Abyss Flask app",
                        args=[["gunicorn", "-w", workers_nb, "--timeout", "300", "-b", "0.0.0.0:" + flask_port, "backend.app:create_app()"]],
                        daemon=True)

    arena = Process(target=launch_arena,
                    name="Abyss Arena",
                    args=[BASE_DIR],
                    daemon=True)
    
    verifier = Process(target=launch_verifier,
                       name="Abyss Verifier",
                       args=[BASE_DIR],
                       daemon=True)
    

    flask_app.start()
    arena.start()
    verifier.start()

    flask_app.join()
    arena.join()
    verifier.join()
    logger_process.join()
    manager.shutdown()
