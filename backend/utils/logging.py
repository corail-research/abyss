from datetime import time
import redis
import logging
import json
import gzip
import os
import shutil

from logging.handlers import QueueListener, TimedRotatingFileHandler

__all__ = [
    'RedisPubSubListener',
    'GzipTimedRotatingFileHandler'
]

class RedisPubSubListener(QueueListener):
    def __init__(self, r: redis.StrictRedis, channels: list[str], *handlers: logging.Handler, **kwargs) -> None:
        self.p = r.pubsub(ignore_subscribe_messages=True)
        self.p.subscribe(**{channel: self.message_handler for channel in channels})

        super().__init__(self.p, *handlers, **kwargs)

    def message_handler(self, msg):
        if msg is None:
            return None
        
        data = json.loads(msg["data"])
        self.handle(logging.makeLogRecord(data))

    def dequeue(self, block):
        self.p.get_message(timeout=(None if block else 0.0))

    def start(self):
        self._thread = self.p.run_in_thread(sleep_time=0.001, daemon=True)

    def stop(self):
        self._thread.stop()
        self._thread.join(timeout=1.0)
        self.p.close()


class GzipTimedRotatingFileHandler(TimedRotatingFileHandler):
    def __init__(self, filename: str | os.PathLike[str], when: str = "h", interval: int = 1, 
                 backupCount: int = 0, encoding: str | None = None, delay: bool = False,
                 utc: bool = False, atTime: time | None = None, errors: str | None = None) -> None:
        super().__init__(filename, when, interval, backupCount, encoding, delay, utc, atTime, errors)

    def namer(self, name):
        return name + ".gz"

    def rotator(self, source, dest):
        with open(source, 'rb') as f_in:
            with gzip.open(dest, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        os.remove(source)
