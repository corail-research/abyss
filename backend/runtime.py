import redis

ARENA_ENABLED_KEY = "abyss:arena:enabled"
ARENA_CHANNEL = "abyss:arena:events"


def new_redis_client(url: str) -> redis.StrictRedis:
    # Ne se connecte pas ici : la connexion est ouverte au premier usage.
    return redis.StrictRedis.from_url(url, decode_responses=True)


def set_arena_enabled(r: redis.StrictRedis, enabled: bool) -> None:
    val = "1" if enabled else "0"
    r.set(ARENA_ENABLED_KEY, val)
    r.publish(ARENA_CHANNEL, val)


def is_arena_enabled(r: redis.StrictRedis) -> bool:
    return r.get(ARENA_ENABLED_KEY) == "1"


def wait_arena_enabled(r: redis.StrictRedis) -> None:
    """
    Block before activation.
    Subscribe BEFORE reding the key.
    """
    pubsub = r.pubsub(ignore_subscribe_messages=True)
    pubsub.subscribe(ARENA_CHANNEL)
    try:
        while not is_arena_enabled(r):
            pubsub.get_message(timeout=1.0)
    finally:
        pubsub.close()
