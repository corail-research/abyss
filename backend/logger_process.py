import os
import logging
import redis

from threading import Event

from backend.utils.logging import (
        RedisPubSubListener, GzipTimedRotatingFileHandler)
from backend.runtime import new_redis_client

_FORMAT = '[%(asctime)s] [%(process)d] %(levelname)s in %(module)s: %(message)s'


def setup_listener(
        r: redis.StrictRedis, filename: str,
        channels_name: list[str],
        formatter: logging.Formatter) -> RedisPubSubListener:
    file_handler = GzipTimedRotatingFileHandler(filename, "midnight")
    file_handler.setFormatter(formatter)
    return RedisPubSubListener(r, channels_name, file_handler)


def start_process(file_and_channels: dict[str, list[str]],
                  ready_event=None):
    logging.basicConfig()
    logger = logging.getLogger()

    formatter = logging.Formatter(_FORMAT)
    r = new_redis_client(
            os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    listeners = []

    for file, channels in file_and_channels.items():
        listener = setup_listener(r, file, channels, formatter)
        listener.start()
        listeners.append(listener)

    logger.info("Logging processes ready")

    if ready_event is not None:
        ready_event.set()

    wait_event = Event()
    wait_event.clear()

    try:
        wait_event.wait()
    except Exception as e:
        logger.error('Exiting logger process: %s', str(e))
    finally:
        for listener in listeners:
            listener.stop()
