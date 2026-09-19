from multiprocessing.managers import BaseManager, EventProxy, AcquirerProxy
from multiprocessing import Event, Lock

__all__ = [
    "AbyssManager"
]

INIT_LOCK = Lock()
INIT_DONE = Event()
LOGGER_STATE = Event()
FLASK_STATE = Event()
# PARALLEL_MATCH = Value(c_uint) NOT WORKING
ARENA_STATE = Event()
# VERIFICATION_QUEUE = Queue()

def init_lock():
    return INIT_LOCK
def init_done():
    return INIT_DONE
def logger_state():
    return LOGGER_STATE
def flask_state():
    return FLASK_STATE
# def parallel_match():
#     return PARALLEL_MATCH
def arena_state():
    return ARENA_STATE
# def verification_queue():
#     return VERIFICATION_QUEUE

class AbyssManager(BaseManager):
    pass

AbyssManager.register('init_lock', callable=init_lock, proxytype=AcquirerProxy)
AbyssManager.register('init_done', callable=init_done, proxytype=EventProxy)
AbyssManager.register('logger_state', callable=logger_state, proxytype=EventProxy)
AbyssManager.register('flask_state', callable=flask_state, proxytype=EventProxy)
# AbyssManager.register('parallel_match', callable=parallel_match, proxytype=ValueProxy)
AbyssManager.register('arena_state', callable=arena_state, proxytype=EventProxy)
# AbyssManager.register('verification_queue', callable=verification_queue)