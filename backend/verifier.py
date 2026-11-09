import logging.handlers
import os
import redis
import shutil
import docker.types
import docker
import logging
import filecmp

from dotenv import load_dotenv
from rlh import RedisPubSubLogHandler

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Agent
from backend.models.enums import AgentStatus
from backend.config import Config
from backend.utils.fight_env import (
        create_env, post_play_env,
        get_error_verify_log, compress_play_env_files)
from backend.runtime import new_redis_client

def run_verifier(redis_conn: redis.StrictRedis):
    verifier_logger = logging.getLogger("arena_logger")
    verifier_logger.setLevel(logging.INFO)

    formatter = logging.Formatter('[%(asctime)s] [%(process)d] %(levelname)s '
                                  'in %(module)s: %(message)s')

    info_handler = RedisPubSubLogHandler(channel_name="ABYSS_VERIFIER_LOGS",
                                         fields=["msg", "module", "levelname",
                                                 "process", "created"])
    info_handler.setFormatter(formatter)
    verifier_logger.addHandler(info_handler)

    error_handler = RedisPubSubLogHandler(channel_name="ABYSS_VERIFIER_ERRORS",
                                          fields=["msg", "module", "levelname",
                                                  "process", "created"])
    error_handler.setFormatter(formatter)
    error_handler.setLevel(logging.ERROR)
    verifier_logger.addHandler(error_handler)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    verifier_logger.addHandler(console_handler)

    client = docker.from_env()

    engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
    Session = sessionmaker(bind=engine)

    VERIFIER_PORT = int(os.environ.get("ABYSS_VERIFIER_PORT", 16000))

    verifier_logger.info("Verifier started")

    try:
        db_session = Session()
        verifier_logger.info("Connection to DB established")

        # Reset redis queue
        redis_conn.delete("ABYSS_VERIFIER_QUEUE")

        # Check pending agents during interruption
        pending_agents = db_session.query(Agent).filter(
            Agent.status == AgentStatus.PENDING
        ).all()
        for agent in pending_agents:
            redis_conn.lpush("ABYSS_VERIFIER_QUEUE", agent.id)

        while True:
            _, agent_id = redis_conn.blpop("ABYSS_VERIFIER_QUEUE")

            # Check if agent was not deleted at the time
            agent = db_session.query(Agent).filter_by(id=int(agent_id)).first()
            if agent is None:
                verifier_logger.info(f"Agent {agent.name} ({agent_id}) "
                                     "not found, skipping")
                continue

            if agent.status != AgentStatus.PENDING:
                verifier_logger.info(
                        f"Agent {agent.id} skipped - "
                        f"status changed to {agent.status}")
                continue

            verifier_logger.info(f"Agent {agent.name} ({agent.id}) "
                                 "received, verification ongoing...")

            try:
                verify_dir = f"agent_{agent.id}"
                create_env(verify_dir, agent.group.id, agent.id)

                container = client.containers.run(
                        'abyss-playground:latest',
                        user=f"{os.getuid()}:{os.getgid()}",
                        volumes=[
                            os.getcwd()+":"+os.getcwd(),
                            "/etc/passwd:/etc/passwd:ro",
                            "/etc/group:/etc/group:ro"],
                        working_dir=os.getcwd(),
                        mem_limit="5g",
                        network="bridge",
                        cpu_count=1,
                        auto_remove=True,
                        detach=True,
                        name="verify",
                        environment=[
                            f"RUNDIR={verify_dir}",
                            f"PLAYER_1=agent_{agent.id}",
                            f"PORT={VERIFIER_PORT}",
                            "TYPE=verify",
                            f"CUID={str(os.getuid())}",
                            f"GUID={str(os.getgid())}"])

                container.wait()

                post_play_env(verify_dir, verify=True)

                agent = db_session.query(Agent).filter_by(
                        id=int(agent_id)
                ).first()

                if agent is None:
                    verifier_logger.info(f"Agent {agent.name} ({agent_id}) "
                                         "deleted during verification, "
                                         "skipping")
                    continue
                if agent.status != AgentStatus.PENDING:
                    verifier_logger.info(f"Agent {agent.name} ({agent_id}) "
                                         "status changed during verification, "
                                         "skipping")
                    continue

                invalid, message = get_error_verify_log(verify_dir, agent.id)

                if invalid:
                    agent.status = AgentStatus.INVALID
                    agent.refusal_message = message
                    verifier_logger.info(f"Agent {agent.name} ({agent.id}) "
                                         f"is invalid: {message}")

                else:
                    agent.status = AgentStatus.INACTIVE
                    verifier_logger.info(f"Agent {agent.name} ({agent.id}) "
                                         "is valid")

                db_session.commit()
                compress_play_env_files(verify_dir)

            except FileNotFoundError as e:
                verifier_logger.error("Exception: %s", str(e))

            verifier_logger.info("Waiting for another agent to verify...")

    except Exception as e:
        verifier_logger.error("Exception: %s", str(e))

    finally:
        client.close()
        db_session.close()


def launch_verifier(base_dir):
    # Move to root dir
    # sys.stdout = open(str(os.getpid()) + ".out", "w")
    load_dotenv(f"{base_dir}/.env")
    os.chdir(base_dir)

    # Create arena playground
    if not os.path.exists("./verifyground"):
        os.mkdir("./verifyground")
    if (not os.path.exists("./verifyground/entrypoint.sh") or
            not filecmp.cmp("./playground/entrypoint.sh",
                            "./verifyground/entrypoint.sh",
                            False)):
        shutil.copy("./docker/entrypoint.sh", "./verifyground/")
    os.chdir("./verifyground")

    redis_conn = new_redis_client(Config.REDIS_URL)
    run_verifier(redis_conn)
