"""
Gunicorn config with threaded workers.
"""
import os

bind = f"0.0.0.0:{os.environ.get('VITE_FLASK_PORT', '5555')}"

workers = int(os.environ.get("FLASK_WORKERS_NB", "4"))
worker_class = "gthread"
threads = int(os.environ.get("FLASK_THREADS_NB", "8"))

timeout = int(os.environ.get("FLASK_TIMEOUT", "60"))
graceful_timeout = int(os.environ.get("FLASK_GRACEFUL_TIMEOUT", "30"))
keepalive = 5

# Recycle workers to bound memory
max_requests = int(os.environ.get("FLASK_MAX_REQUESTS", "5000"))
max_requests_jitter = 500

# Heartbeat in memory
if os.path.isdir("/dev/shm"):
    worker_tmp_dir = "/dev/shm"

# DO NOT activate preload_app : corrupt SQLAlchemy pool.
accesslog = None
errorlog = "-"
loglevel = os.environ.get("FLASK_LOG_LEVEL", "info")
