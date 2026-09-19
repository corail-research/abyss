import logging
import redis
import time
import os

from threading import Event

from backend.utils.logging import RedisPubSubListener, GzipTimedRotatingFileHandler
from backend.utils.manager import AbyssManager


def setup_listener(r: redis.StrictRedis, filename: str, channels_name: list[str], formatter: logging.Formatter) -> RedisPubSubListener:
    file_handler = GzipTimedRotatingFileHandler(filename, "midnight")
    file_handler.setFormatter(formatter)
    return RedisPubSubListener(r, channels_name, file_handler)


def start_process(file_and_channels: dict[str, list[str]]):
    logging.basicConfig()
    logger = logging.getLogger()

    manager = AbyssManager(('', int(os.environ.get("ABYSS_MANAGER_PORT", 50000))), authkey=eval(os.environ.get("ABYSS_MANAGER_AUTHKEY", "b'abracadabra'")))
    manager.connect()

    formatter = logging.Formatter('[%(asctime)s] [%(process)d] %(levelname)s in %(module)s: %(message)s')
    r = redis.StrictRedis(decode_responses=True)
    listeners = []

    for file, channels in file_and_channels.items():
        listener = setup_listener(r, file, channels, formatter)
        listener.start()
        listeners.append(listener)
    
    logger.info("Logging processes ready")
    manager.logger_state().set()

    wait_event = Event()
    wait_event.clear()

    try:
        wait_event.wait()
    except Exception as e:
        logger.error('Exiting logger process: %s', str(e))
    finally:
        for listener in listeners:
            listener.stop()
        