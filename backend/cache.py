"""
Redis cache helper for the public endpoints.

The cache is shared by every gunicorn worker (Redis, not in-process).
Redis
errors are swallowed: a Redis outage only makes the endpoints slower, it
never breaks them.
"""
import json
from decimal import Decimal

from redis.exceptions import RedisError

CACHE_PREFIX = "abyss:cache:groups"
LEVD_KEY = f"{CACHE_PREFIX}:levd"
PALMARES_KEY = f"{CACHE_PREFIX}:palmares"
MIN_STATS_KEY = f"{CACHE_PREFIX}:min_stats"

ALL_KEYS = (LEVD_KEY, PALMARES_KEY, MIN_STATS_KEY)


def _json_default(value):
    """Serialize the Decimal values returned by SUM(BIGINT) aggregates."""
    if isinstance(value, Decimal):
        if value == value.to_integral_value():
            return int(value)
        return float(value)
    raise TypeError(
        f"Object of type {type(value).__name__} is not JSON serializable")


def cache_get(client, key):
    """Return the cached list, or None on miss / Redis error."""
    try:
        raw = client.get(key)
    except RedisError:
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def cache_set(client, key, value, ttl):
    """Store ``value`` for ``ttl`` seconds; ignore Redis errors."""
    try:
        client.setex(key, ttl, json.dumps(value, default=_json_default))
    except (RedisError, TypeError, ValueError):
        pass


def invalidate_group_stats(client):
    """Drop the cached aggregates (call at the end of an arena epoch)."""
    try:
        client.delete(*ALL_KEYS)
    except RedisError:
        pass
