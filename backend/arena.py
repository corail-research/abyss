import logging.handlers
import os
import redis
import shutil
import docker.types
import docker
import logging
import filecmp

from datetime import datetime, timedelta, timezone
from threading import Event, Thread
from dotenv import load_dotenv
from rlh import RedisPubSubLogHandler

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, joinedload

from backend.models import Fight, Agent, Arena, CustomStats
from backend.models.enums import FightStatus, AgentStatus
from backend.utils.fight_env import (
        create_env, post_play_env, get_record,
        change_agent_name_in_json, BrokenMatch, GameError,
        compress_play_env_files)
from backend.utils.matchmaking import compute_matches, calculate_elo_update
from backend.utils.leagues import update_league_standings
from backend.cache import invalidate_group_stats
from backend.runtime import (
        new_redis_client, set_arena_enabled, wait_arena_enabled)

from backend.config import Config

# SQL Engine and Session
engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
Session = sessionmaker(bind=engine)


def event_listener(events, matchs_info: dict[int, dict],
                   event_counter: Event, max_matchs: int,
                   logger: logging.Logger):
    counter = 0
    for event in events:
        name = event.get('Actor', {})\
                .get('Attributes', {})\
                .get('name', '')

        # ignore unknown match
        if not name.startswith("fight"):
            continue
        info = matchs_info.get(name)
        if info is None or "event" not in info:
            logger.warning("Ignoring event for unknown match %s", name)
            continue

        if event.get('Action') == 'destroy':
            logger.info(str(name) + " finished")
            info["event"].set()
            event_counter.set()
            counter -= 1
        elif event.get('Action') == 'create':
            if counter >= max_matchs - 1:
                event_counter.clear()
            logger.info(str(name) + " in play")
            counter += 1
        logger.info(f"MATCH COUNTER: {counter}")


def update_match(key: str, matchs_info: dict, event_match: Event):
    matchs_info[key]["event"] = event_match


def add_match(key: str, fight: Fight, matchs_info: dict,
              port: int = None, cpu: int = None, event_match: Event = None):
    matchs_info.update({key: {"player1": fight.player1.id,
                              "group1": fight.player1.group.id,
                              "player2": fight.player2.id,
                              "group2": fight.player2.group.id,
                              "fight": fight.id,
                              "port": port,
                              "cpu": cpu}})

    if event_match is not None:
        update_match(key, matchs_info, event_match)


def play_match(client: docker.DockerClient, port: int,
               cpu: int, key: str, matchs_info: dict,
               fight: Fight = None):
    event_match = Event()
    event_match.clear()

    if fight is None:
        update_match(key, matchs_info, event_match)
    else:
        add_match(key, fight, matchs_info, port, cpu, event_match)

    create_env(key, matchs_info[key]["group1"], matchs_info[key]["player1"],
               matchs_info[key]["group2"], matchs_info[key]["player2"])

    matchs_info[key]["container"] = client.containers.run(
            'abyss-playground:latest',
            user=f"{os.getuid()}:{os.getgid()}",
            volumes=[
                os.getcwd()+":"+os.getcwd(),
                "/etc/passwd:/etc/passwd:ro",
                "/etc/group:/etc/group:ro"],
            working_dir=os.getcwd(),
            mem_limit="9g",
            network="bridge",
            detach=True,
            cpu_count=1,
            cpuset_cpus=str(cpu),
            auto_remove=True,
            name=key,
            environment=[
                f"RUNDIR={key}",
                f"PLAYER_1=agent_{matchs_info[key]['player1']}",
                f"PLAYER_2=agent_{matchs_info[key]['player2']}",
                f"PORT={port}",
                f"CUID={str(os.getuid())}",
                f"GUID={str(os.getgid())}"])


def update_elo_for_fight(fight: Fight, db_session, logger: logging.Logger):
    """Update ELO ratings for both players based on fight result."""
    if fight.winner_id is None:
        logger.warning(f"Fight {fight.id} no winner, skipping ELO update")
        return

    player1 = db_session.query(Agent).filter_by(id=fight.player1_id).first()
    player2 = db_session.query(Agent).filter_by(id=fight.player2_id).first()
    if not player1 or not player2:
        logger.warning(f"Missing agent for Fight {fight.id}")
        return

    if fight.winner_id == player1.id:
        new_elo1, new_elo2 = calculate_elo_update(player1.elo, player2.elo)
    elif fight.winner_id == player2.id:
        new_elo2, new_elo1 = calculate_elo_update(player2.elo, player1.elo)
    else:
        logger.warning(f"Winner ID {fight.winner_id} does not match players")
        return

    player1.elo = new_elo1
    player2.elo = new_elo2
    if player1.elo > player1.peak_elo:
        player1.peak_elo = player1.elo
    if player2.elo > player2.peak_elo:
        player2.peak_elo = player2.elo
    db_session.commit()
    logger.info(
        f"Updated ELO: {player1.name} {player1.elo}, "
        f"{player2.name} {player2.elo}")


def cancel_fight(db_session, fight_id, logger, reason):
    # Cancel a fight without blaming an agent.
    # A fight already marked DONE is never downgraded.
    if fight_id is None:
        return
    try:
        fight = db_session.query(Fight).filter_by(id=fight_id).first()
        if fight is not None and fight.status != FightStatus.DONE:
            fight.status = FightStatus.CANCELLED
            db_session.commit()
            logger.warning("Fight %s cancelled: %s", fight_id, reason)
    except Exception:
        db_session.rollback()
        logger.exception("Cannot cancel fight %s", fight_id)


def run_arena(redis_conn: redis.StrictRedis):
    arena_logger = logging.getLogger("arena_logger")
    arena_logger.setLevel(logging.INFO)

    formatter = logging.Formatter(
            '[%(asctime)s] [%(process)d] %(levelname)s in %(module)s: %(message)s')

    info_handler = RedisPubSubLogHandler(
            channel_name="ABYSS_ARENA_LOGS",
            fields=["msg", "module", "levelname", "process", "created"])
    info_handler.setFormatter(formatter)
    arena_logger.addHandler(info_handler)

    error_handler = RedisPubSubLogHandler(
            channel_name="ABYSS_ARENA_ERRORS",
            fields=["msg", "module", "levelname", "process", "created"])
    error_handler.setFormatter(formatter)
    error_handler.setLevel(logging.ERROR)
    arena_logger.addHandler(error_handler)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    arena_logger.addHandler(console_handler)

    client = docker.from_env()

    URL = Config.SQLALCHEMY_DATABASE_URI
    LEAGUES = Config.LEAGUES

    db_session = Session()
    matchs_info = {}

    try:
        arena_logger.info("Connection established")
        arena_logger.info("Arena started")

        first_epoch = True
        while True:
            wait_arena_enabled(redis_conn)

            db_session.expire_all()
            arena = db_session.get(Arena, True)
            if arena is None:
                raise RuntimeError(
                        "Arena config not found in DB."
                        "Please launch `flask seed`")

            MAX_MATCH = arena.parallel_match
            arena_logger.info("START EPOCH")
            arena_logger.info(f"MAX PARALLEL MATCH: {MAX_MATCH}")

            ports = [16001 + i for i in range(MAX_MATCH)]
            cpus = [i for i in range(MAX_MATCH)]
            used_ports = {}
            used_cpus = {}
            event_counter = Event()
            events = client.events(
                    decode=True,
                    filters={
                        'type': 'container',
                        'image': 'abyss-playground:latest'})

            listener_thread = Thread(
                    target=event_listener,
                    args=[events, matchs_info, event_counter,
                          MAX_MATCH, arena_logger],
                    daemon=True)

            listener_thread.start()
            event_counter.set()

            unfinished_matches = False
            if first_epoch:

                unfinished_fights = db_session.query(Fight).options(
                    joinedload(Fight.player1),
                    joinedload(Fight.player2)
                ).filter(Fight.status.in_(['in_progress', 'scheduled'])).all()

                if len(unfinished_fights) > 0:
                    unfinished_matches = True

                    keys = [f"fight_{fight.id}" for fight in unfinished_fights]
                    arena_logger.info(F"NUMBER OF UNFINISHED MATCH: {len(unfinished_fights)}")

                    for key in keys:
                        if os.path.exists(f"./{key}"):
                            shutil.rmtree(key)

                    increment_date = 1
                    for i, fight in enumerate(unfinished_fights):

                        if i < MAX_MATCH:
                            fight.date = datetime.now(timezone.utc)
                            fight.status = 'in_progress'
                        else:
                            fight.status = 'scheduled'
                            fight.scheduled_date = datetime.now(timezone.utc) + timedelta(minutes=30*increment_date)
                            if (i+1) % MAX_MATCH == 0:
                                increment_date += 1 

                    db_session.commit()
                    arena_logger.info(f"UDPATED {len(unfinished_fights)} UNFINISHED MATCHES")

                    for i, fight in enumerate(unfinished_fights):

                        if i < MAX_MATCH:
                            used_ports[ports[i]] = keys[i]
                            used_cpus[cpus[i]] = keys[i]
                            play_match(client, ports[i],
                                       cpus[i], keys[i],
                                       matchs_info, fight)
                        else:
                            add_match(keys[i], fight, matchs_info)

            if not unfinished_matches:
                # Get agents to play
                arena_logger.info("Get agents from matchmaking results")

                matchmaking = compute_matches(db_session)

                arena_logger.info(
                        f"NUMBER OF MATCH IN EPOCH: {len(matchmaking)}")

                new_fights = []
                increment_date = 1
                for i, (a1, a2) in enumerate(matchmaking):
                    fight = Fight(
                        player1_id=a1["id"],
                        player2_id=a2["id"],
                        status="in_progress" if i < MAX_MATCH else "scheduled",
                    )

                    if i < MAX_MATCH:
                        fight.date = datetime.now(timezone.utc)
                    else:
                        fight.scheduled_date = (
                                datetime.now(timezone.utc)
                                + timedelta(minutes=30 * increment_date))
                        if (i+1) % MAX_MATCH == 0:
                            increment_date += 1

                    new_fights.append(fight)

                db_session.add_all(new_fights)
                db_session.commit()
                arena_logger.info(f"CREATED {len(new_fights)} MATCHES")

                keys = [f"fight_{fight.id}" for fight in new_fights]

                for i, fight in enumerate(new_fights):
                    if i < MAX_MATCH:
                        used_ports[ports[i]] = keys[i]
                        used_cpus[cpus[i]] = keys[i]
                        play_match(client, ports[i], cpus[i], keys[i], matchs_info, fight)
                    else:
                        add_match(keys[i], fight, matchs_info)

            while len(keys) > 0:
                event_counter.wait()
                nb_keys = len(keys)
                increment_date = 1

                for i in range(nb_keys):
                    if i >= len(keys):
                        continue
                    if ("event" in matchs_info[keys[i]]
                        and matchs_info[keys[i]]["event"].is_set()):
                        try:
                            # Clean game env

                            arena_logger.info(
                                    f"{keys[i]} finished: post play env...")
                            post_play_env(str(keys[i]))

                            # Retrieve winner and scores
                            arena_logger.info(f"{keys[i]}: retrieve JSON...")
                            json_record = get_record(keys[i], matchs_info[keys[i]]["player1"], matchs_info[keys[i]]["player2"], arena_logger).get("final_summary")
                            arena_logger.info(f"{keys[i]} JSON record retrieved")

                            # Player ID translation
                            id_translate = {}
                            for j, player in enumerate(json_record["players"]):
                                id_translate[player["id"]] = matchs_info[keys[i]]["player"+str(j+1)]

                            #TODO: this constraint Abyss to handle game with only one winner for now
                            winner_id = id_translate[json_record["winners_id"][0]]
                            arena_logger.info(f"{keys[i]} winner retrieved: {winner_id}")

                            # Agent scores
                            agent1_score = json_record["scores"][str(json_record["players"][0]["id"])]
                            arena_logger.info(f"{keys[i]} score {matchs_info[keys[i]]['player1']} retrieved: {agent1_score}")
                            agent2_score = json_record["scores"][str(json_record["players"][1]["id"])]
                            arena_logger.info(f"{keys[i]} score {matchs_info[keys[i]]['player2']} retrieved: {agent2_score}")

                            # Create data payload
                            data = {
                                **{k: v for k, v in json_record.items() if k not in ["scores", "players", "winners_id", "custom_stats"]},
                                "score_player1": agent1_score,
                                "score_player2": agent2_score,
                                "winner_id": winner_id,
                            }

                            fight_id = matchs_info[keys[i]]['fight']
                            fight = db_session.query(Fight).filter_by(id=fight_id).first()

                            if fight is None:
                                arena_logger.info(
                                        f"Fight {fight_id} not found in DB, skipping")
                                matchs_info.pop(keys.pop(i))
                                continue

                            for key, value in data.items():
                                setattr(fight, key, value)

                            fight.status = FightStatus.DONE

                            # create stats
                            custom_stats = []
                            print(json_record)
                            for stat in json_record["custom_stats"]:
                                custom_stats.append(CustomStats(
                                    fight_id=fight.id,
                                    agent_id=id_translate[stat['agent_id']],
                                    name=stat['name'],
                                    value=stat['value']
                                ))
                            print(custom_stats)
                            db_session.add_all(custom_stats)
                            db_session.commit()

                            arena_logger.info(
                                    f"{keys[i]} custom stats created")

                            agent1_name = (f"{fight.player1.group.name}"
                                           f" #{fight.player1.name}")
                            agent2_name = (f"{fight.player2.group.name}"
                                           f" #{fight.player2.name}")
                            arena_logger.info(
                                    f"{keys[i]} - "
                                    f"{agent1_name} VS {agent2_name}")

                            try:
                                change_agent_name_in_json(
                                        keys[i], agent1_name, agent2_name)
                            except Exception:
                                arena_logger.exception(
                                    "Cannot rewrite agent names for %s",
                                    keys[i])

                            if fight.player1_id == winner_id:
                                winner_name = agent1_name
                            else:
                                winner_name = agent2_name

                            arena_logger.info(
                                f"{keys[i]} - {agent1_name} ({agent1_score}) VS {agent2_name} ({agent2_score}):  winner is {winner_name}"
                            )

                            # update agents ELO
                            try:
                                update_elo_for_fight(
                                        fight, db_session, arena_logger)
                            except Exception:
                                db_session.rollback()
                                arena_logger.exception(
                                    "Cannot update ELO for %s", keys[i])

                            # compress (best-effort) env files
                            try:
                                compress_play_env_files(str(keys[i]))
                            except Exception:
                                arena_logger.exception(
                                    "Cannot compress files for %s", keys[i])

                        # If the match did not end normally, cancel it
                        # and place both agents in quarantine
                        # TODO: apply the changes in the JSON in this case too.
                        except BrokenMatch as e:
                            arena_logger.warning(
                                    f"{keys[i]} did not end gracefully : {matchs_info[keys[i]]['player1']} VS {matchs_info[keys[i]]['player2']}")

                            fight_id = matchs_info[keys[i]]['fight']
                            fight = db_session.query(Fight).filter_by(id=fight_id).first()
                            if fight:
                                fight.status = FightStatus.CANCELLED
                                db_session.commit()
                                arena_logger.info(f"Fight {fight_id} CANCELLED")
                            else:
                                arena_logger.info(f"Fight {fight_id} not found")

                            if e.confidence:
                                # If the responsible agent is identified, mark it invalid
                                agent_id = e.agent_id
                                arena_logger.warning(f"Responsible agent: agent_{agent_id}")
                                agent = db_session.query(Agent).filter_by(
                                        id=agent_id
                                ).first()
                                if agent:
                                    agent.status = AgentStatus.INVALID
                                    agent.refusal_message = e.message
                                    db_session.commit()
                                    arena_logger.warning(f"Agent {agent_id} INVALID")
                                else:
                                    arena_logger.info(f"Agent {agent_id} not found")

                            else:
                                # Place both agents in quarantine
                                # if the parser could not identify the responsible agent
                                player1_id = matchs_info[keys[i]]['player1']
                                player2_id = matchs_info[keys[i]]['player2']

                                quarantine_reason = (
                                        f"UNIDENTIFIED ERROR: {matchs_info[keys[i]]['fight']} - {player1_id} vs {player2_id}. "
                                        f"{e.message if hasattr(e, 'message') else str(e)}"
                                )

                                for pid in [player1_id, player2_id]:
                                    agent = db_session.query(Agent).filter_by(
                                        id=pid
                                    ).first()
                                    if agent:
                                        agent.status = AgentStatus.QUARANTINE
                                        agent.refusal_message = quarantine_reason
                                        arena_logger.warning(
                                            f"Agent {pid} placed in quarantine")
                                db_session.commit()

                        except GameError as e:
                            # Cancel the fight and
                            # do not invalidate or quarantine any agent.
                            db_session.rollback()
                            arena_logger.error(
                                "%s: game error: %s", keys[i], e,
                                exc_info=True)
                            cancel_fight(
                                db_session,
                                matchs_info[keys[i]].get("fight"),
                                arena_logger,
                                f"game error: {e}")

                        except Exception as e:
                            # Arena must survive any record/log/game anomaly.
                            db_session.rollback()
                            arena_logger.error(
                                "%s: unexpected error: %s", keys[i], e,
                                exc_info=True)
                            cancel_fight(
                                db_session,
                                matchs_info[keys[i]].get("fight"),
                                arena_logger,
                                f"unexpected error: {e}")

                        used_ports[matchs_info[keys[i]]["port"]] = None
                        used_cpus[matchs_info[keys[i]]["cpu"]] = None
                        matchs_info.pop(keys.pop(i))

                    elif i < MAX_MATCH and "event" not in matchs_info[keys[i]]:
                        fight_id = matchs_info[keys[i]]['fight']
                        fight = db_session.query(Fight).filter_by(
                            id=fight_id
                        ).first()
                        if fight:
                            fight.status = FightStatus.IN_PROGRESS
                            fight.date = datetime.now(timezone.utc)
                            db_session.commit()
                        else:
                            arena_logger.info(f"Fight {fight_id} not found")
                            matchs_info.pop(keys.pop(i))
                            continue

                        port = None
                        cpu = None
                        for j in range(MAX_MATCH):
                            if port is None and used_ports[ports[j]] is None:
                                port = ports[j]
                                used_ports[ports[j]] = keys[i]
                            if cpu is None and used_cpus[cpus[j]] is None:
                                cpu = cpus[j]
                                used_cpus[cpus[j]] = keys[i]
                            if cpu is not None and port is not None:
                                break
                        play_match(client, port, cpu, keys[i], matchs_info, fight)

                    elif i >= MAX_MATCH:
                        # Update scheduled_time of next fights
                        fight_id = matchs_info[keys[i]]['fight']
                        fight = db_session.query(Fight).filter_by(id=fight_id).first()
                        if fight:
                            fight.scheduled_date = datetime.now(timezone.utc) + timedelta(minutes=30*increment_date)
                            db_session.commit()
                        else:
                            arena_logger.info(f"Fight {fight_id} not found")
                            matchs_info.pop(keys.pop(i))
                            continue

                        if (i+1) % MAX_MATCH == 0:
                            increment_date += 1

            events.close()

            update_league_standings(db_session, LEAGUES)
            invalidate_group_stats(redis_conn)

            arena_logger.info("Leagues updated")
            arena_logger.info("END EPOCH")
            first_epoch = False

    except Exception as e:
        arena_logger.error("Exception: %s", str(e))
        if matchs_info is not None:
            for key, info in matchs_info.items():
                container = info.get("container")
                if container is not None:
                    try:
                        container.kill()
                    except Exception:
                        pass
        try:
            set_arena_enabled(redis_conn, False)
            db_session.rollback()
            db_session.query(Arena).filter_by(id=True).update({"state": False})
            db_session.commit()
        except Exception:
            arena_logger.exception("Cannot deactivate arena")
    finally:
        client.close()
        db_session.close()


def launch_arena(base_dir):
    # Move to root dir
    # sys.stdout = open(str(os.getpid()) + ".out", "w")
    load_dotenv(f"{base_dir}/.env")
    os.chdir(base_dir)

    # Create arena playground
    if not os.path.exists("./playground"):
        os.mkdir("./playground")
    if (not os.path.exists("./playground/entrypoint.sh") or
        not filecmp.cmp("./playground/entrypoint.sh",
                        "./playground/entrypoint.sh", False)):
        shutil.copy("./docker/entrypoint.sh", "./playground/")
    os.chdir("./playground")

    redis_conn = new_redis_client(Config.REDIS_URL)
    run_arena(redis_conn)


if __name__ == '__main__':
    BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

    launch_arena(BASE_DIR)
