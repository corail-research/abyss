import re
import shutil
import os
import traceback
import gzip
import tempfile
import zipfile

from datetime import datetime, timezone

from flask import (
        json, request, jsonify, current_app,
        has_request_context, send_from_directory, send_file)
from flask_restx import Resource
from sqlalchemy import and_, or_, func, select
from sqlalchemy.orm import joinedload, selectinload

from backend.db import db

from backend.models.enums import FightStatus, AgentStatus
from backend.models.schemas import (
        FightSchema, CustomStatsSchema, SmallAgentSchema)
from backend.models import Group, Fight, Agent, CustomStats, Student
from backend.app.utils import log_and_return

from backend.app.api import (
        api, admin_required, jwt_required, get_jwt_identity,
        fight_post_model, fight_model, custom_stats_model,
        update_fight_model
        )
from backend.app.fields import schema_for

fight_ns = api.namespace('fights', description='Fight operations')

_RECORD_GZ = re.compile(r"^__REC__\d+\.json\.gz$")
_RECORD_JSON = re.compile(r"^__REC__\d+\.json$")


def _fight_query():
    """Fight query with the relations serialized by FightSchema."""
    return Fight.query.options(
        joinedload(Fight.player1).joinedload(Agent.group),
        joinedload(Fight.player2).joinedload(Agent.group),
        selectinload(Fight.custom_stats))


def _x_fields():
    return request.headers.get("X-Fields") if has_request_context() else None


def _archive_record_path(fight_id):
    """
    Return tuple (zip name, path, is_gzipped) or None.
    Prefer __REC__*.json.gz, otherwise fall back to __REC__*.json.
    """
    directory = os.path.join(
        current_app.config["FIGHTS_FOLDER"],
        f"fight_{fight_id}",
    )
    if not os.path.isdir(directory):
        return None

    names = sorted(os.listdir(directory))

    for name in names:
        if _RECORD_GZ.fullmatch(name):
            return name, os.path.join(directory, name), True

    for name in names:
        if _RECORD_JSON.fullmatch(name):
            # Compress it on the fly; keep the .gz extension in the entry name
            return name + ".gz", os.path.join(directory, name), False

    return None


def parse_datetime_utc(value):
    """Parse an ISO‑8601 string to a timezone‑aware UTC datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        # If already a datetime, ensure it's UTC-aware
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    # If it's a string, parse it
    if isinstance(value, str):
        # Handle 'Z' and possible space replacement
        normalized = value.replace('Z', '+00:00').replace(' ', 'T')
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt
    raise ValueError(f"Unsupported date format: {value}")


def get_fight_list(status=[], paginate=False, page=1, limit=20, agent_ids=[]):
    query = _fight_query().order_by(Fight.id.desc())

    if len(status) > 0:
        query = query.filter(Fight.status.in_(status))

    if len(agent_ids) > 0:
        query = query.filter((Fight.player1_id.in_(agent_ids)) |
                             (Fight.player2_id.in_(agent_ids)))

    if paginate:
        query = query.paginate(page=page, per_page=limit, error_out=False)

    return schema_for(FightSchema, _x_fields()).dump(query, many=True)


@fight_ns.route('')
class FightCollection(Resource):
    @admin_required
    @fight_ns.expect(fight_post_model)
    @api.response(200, 'Success', [fight_model])
    def post(self):
        try:
            data = request.get_json()

            if "date" in data:
                data["date"] = parse_datetime_utc(data["date"])

            if "scheduled_date" in data:
                data["scheduled_date"] = parse_datetime_utc(
                        data["scheduled_date"])

            if "status" in data:
                data["status"] = FightStatus(data["status"])

            player1 = Agent.query.get(data['player1_id'])
            player2 = Agent.query.get(data['player2_id'])

            if player1 and player2:
                data["player1"] = player1
                data["player2"] = player2
                new_fight = Fight(**data)
                db.session.add(new_fight)
                db.session.commit()

                custom_stats_data = data.get('custom_stats', [])
                for stat in custom_stats_data:
                    custom_stat = CustomStats(fight_id=new_fight.id, **stat)
                    db.session.add(custom_stat)

                db.session.commit()
                log_and_return(
                        current_app.logger,
                        f"Fight {new_fight.id} between "
                        f"{player1.name} and {player2.name} created",
                        status_code=201)
                return FightSchema().dump(new_fight), 201
            else:
                return log_and_return(
                        current_app.logger,
                        'Attempt to create a fight with '
                        'one or more non-existing agents',
                        'warning', 403)
        except Exception as e:
            return log_and_return(
                    current_app.logger,
                    f'Unexpected Error: {str(e)}',
                    'error', 500)

    @api.response(200, 'Success', [fight_model])
    @api.doc(params={'paginate': 'Paginate results or not',
                     'page': 'Page number',
                     'limit': 'Number of items per page',
                     'status': 'Fight status'})
    def get(self):
        try:
            paginate = request.args.get(
                    'paginate', 'true')
            page = request.args.get(
                    'page', 1, type=int)
            limit = request.args.get(
                    'limit', 20, type=int)
            status = request.args.get(
                    'status', [], type=lambda x: x.split(','))
            agent_ids = request.args.get(
                    'agent_ids', [], type=lambda x: x.split(','))

            if len(agent_ids) > 0:
                agent_ids = [int(agent_id) for agent_id in agent_ids]

            paginate = True if paginate == 'true' else False

            real_status = []
            for s in status:
                if not FightStatus.has_value(s):
                    return log_and_return(
                            current_app.logger,
                            f"Unknown status: {s}",
                            "warning")
                real_status.append(FightStatus(s))

            return get_fight_list(real_status, paginate,
                                  page, limit, agent_ids)
        except Exception as e:
            return log_and_return(
                    current_app.logger,
                    f'Unexpected Error: {str(e)}',
                    'error', 500)


@fight_ns.route('/<fight_status:status>/<int:limit>/<int:page>/index.json')
class FightCollectionStatusPage(Resource):
    def get(self, status, limit, page):
        if not FightStatus.has_value(status):
            return log_and_return(
                    current_app.logger,
                    f"Unknown status: {status}",
                    "warning")
        return get_fight_list([status], True, page, limit)


def count_fights_with_status(status=[], agent_ids=[]):
    query = Fight.query

    if len(status) > 0:
        query = query.filter(Fight.status.in_(status))

    if len(agent_ids) > 0:
        query = query.filter(Fight.player1_id.in_(agent_ids) |
                             Fight.player2_id.in_(agent_ids))

    return query.count()


@fight_ns.route('/count')
class CountFights(Resource):
    @api.doc(params={'status': 'Fight status',
                     'agent_ids': 'Agent IDs to include'})
    def get(self):
        status = request.args.get(
                'status', [], type=lambda x: x.split(','))
        agent_ids = request.args.get(
                'agent_ids', [], type=lambda x: x.split(','))

        real_status = []
        for s in status:
            if not FightStatus.has_value(s):
                return log_and_return(
                        current_app.logger, f"Unknown status: {s}", "warning")
            real_status.append(FightStatus(s))

        return count_fights_with_status(real_status, agent_ids)


@fight_ns.route('/<fight_status:status>/count.json')
class CountFightsStatus(Resource):
    def get(self, status):
        if not FightStatus.has_value(status):
            return log_and_return(
                    current_app.logger, f"Unknown status: {status}", "warning")
        return count_fights_with_status([status])


@fight_ns.route('/group/<int:group_id>')
class FightGroup(Resource):
    @api.response(200, 'Success', [fight_model])
    @api.doc(params={'paginate': 'Paginate results or not',
                     'page': 'Page number',
                     'limit': 'Number of items per page',
                     'status': 'Fight status'})
    def get(self, group_id):
        paginate = request.args.get('paginate', 'false')
        paginate = True if paginate == 'true' else False

        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)

        status = request.args.get(
                'status', [], type=lambda x: x.split(","))
        agent_ids = request.args.get(
                'agent_ids', [], type=lambda x: x.split(","))
        victory = request.args.get(
                'victory', None)

        if len(agent_ids) > 0:
            agent_ids = [int(agent_id) for agent_id in agent_ids]

        real_status = []
        for s in status:
            if not FightStatus.has_value(s):
                return log_and_return(
                        current_app.logger,
                        f"Unknown status: {s}", "warning")
            real_status.append(FightStatus(s))

        query = _fight_query().filter(
            (Fight.player1.has(group_id=group_id)) |
            (Fight.player2.has(group_id=group_id))
        ).order_by(Fight.id.desc())

        if len(real_status) > 0:
            query = query.filter(Fight.status.in_(real_status))

        if len(agent_ids) > 0:
            query = query.filter((Fight.player1_id.in_(agent_ids)) |
                                 (Fight.player2_id.in_(agent_ids)))

        # Win/loss filtering
        if victory in ['true', 'false']:
            all_agent_ids = [
                    agent.id for agent
                    in Agent.query.filter(Agent.group_id == group_id).all()]
            if victory == 'true':
                query = query.filter(Fight.winner_id.in_(all_agent_ids))
            elif victory == 'false':
                query = query.filter(~Fight.winner_id.in_(all_agent_ids))

        if paginate:
            query = query.paginate(page=page, per_page=limit, error_out=False)

        return schema_for(FightSchema, _x_fields()).dump(query, many=True)


@fight_ns.route('/group/<int:group_id>/count')
class CountFightGroup(Resource):
    @api.doc(params={'status': 'Fight status',
                     'agent_ids': 'Agent IDs to include'})
    def get(self, group_id):
        status = request.args.get(
                'status', [], type=lambda x: x.split(","))
        agent_ids = request.args.get(
                'agent_ids', [], type=lambda x: x.split(","))
        victory = request.args.get(
                'victory', None)

        real_status = []
        for s in status:
            if not FightStatus.has_value(s):
                return log_and_return(
                        current_app.logger,
                        f"Unknown status: {s}",
                        "warning")
            real_status.append(FightStatus(s))

        query = Fight.query.filter((Fight.player1.has(group_id=group_id)) |
                                   (Fight.player2.has(group_id=group_id)))

        if len(real_status) > 0:
            query = query.filter(Fight.status.in_(real_status))

        if len(agent_ids) > 0:
            query = query.filter((Fight.player1_id.in_(agent_ids)) |
                                 (Fight.player2_id.in_(agent_ids)))

        # Win/loss filtering
        if victory in ['true', 'false']:
            all_agent_ids = [
                    agent.id for agent
                    in Agent.query.filter(Agent.group_id == group_id).all()]
            if victory == 'true':
                query = query.filter(Fight.winner_id.in_(all_agent_ids))
            elif victory == 'false':
                query = query.filter(~Fight.winner_id.in_(all_agent_ids))

        return query.count()


@fight_ns.route("/group/<int:group_id>/archive")
class FightGroupArchive(Resource):
    @jwt_required()
    @api.doc(params={
        "agent_ids": ("Comma-separated list of agent IDs "
                      "(default: all group agents)"),
    })
    def get(self, group_id):
        identity = get_jwt_identity()
        student = Student.query.get(identity["id"])
        if not student:
            return log_and_return(
                    current_app.logger,
                    "Student not found",
                    "warning", 401)

        if student.role != "admin" and student.group_id != group_id:
            return log_and_return(
                    current_app.logger,
                    "Unauthorized access to this group archive",
                    "warning", 403)

        # 1. Resolve the agents to include
        raw_agent_ids = request.args.get("agent_ids", "")
        if raw_agent_ids:
            try:
                requested_ids = {
                    int(value) for value in raw_agent_ids.split(",") if value
                }
            except ValueError:
                return log_and_return(
                    current_app.logger,
                    "Invalid agent_ids",
                    "warning", 400)

            agent_ids = db.session.execute(
                select(Agent.id).where(
                    Agent.group_id == group_id,
                    Agent.id.in_(requested_ids),
                )
            ).scalars().all()

            if not agent_ids:
                return log_and_return(
                    current_app.logger,
                    "No valid agent ID for this group",
                    "warning", 400)
        else:
            agent_ids = db.session.execute(
                select(Agent.id).where(Agent.group_id == group_id)
            ).scalars().all()

            if not agent_ids:
                return log_and_return(
                    current_app.logger,
                    "No agents in this group",
                    "warning", 400)

        # 2. Fetch only fight IDs, not ORM objects
        fight_ids = db.session.execute(
            select(Fight.id)
            .where(Fight.status == FightStatus.DONE)
            .where(
                or_(
                    Fight.player1_id.in_(agent_ids),
                    Fight.player2_id.in_(agent_ids),
                )
            )
            .order_by(Fight.id)
        ).scalars().all()

        # 3. Build the ZIP in a spooled temporary file
        archive = tempfile.SpooledTemporaryFile(
            max_size=16 * 1024 * 1024,
        )

        with zipfile.ZipFile(
                archive, "w", zipfile.ZIP_STORED, True) as zip_file:
            manifest = {"group_id": group_id, "fights": [], "missing": []}

            for fight_id in fight_ids:
                record = _archive_record_path(fight_id)
                if record is None:
                    manifest["missing"].append(fight_id)
                    current_app.logger.warning(
                        "No record file for fight %s", fight_id)
                    continue

                entry_name, path, already_gzipped = record
                arcname = f"fight_{fight_id}/{entry_name}"

                if already_gzipped:
                    # Raw copy, streamed from disk
                    zip_file.write(path, arcname, zipfile.ZIP_STORED)
                else:
                    # Rare fallback: gzip the .json on the fly
                    with open(path, "rb") as raw_file:
                        compressed = gzip.compress(raw_file.read())
                    zip_file.writestr(arcname, compressed, zipfile.ZIP_STORED)

                manifest["fights"].append(fight_id)

            zip_file.writestr(
                "manifest.json",
                json.dumps(manifest, indent=2),
                compress_type=zipfile.ZIP_STORED,
            )

        archive.seek(0)

        return send_file(
            archive,
            mimetype="application/zip",
            as_attachment=True,
            download_name=f"fights_group_{group_id}.zip")


@fight_ns.route('/<int:id>')
class FightItem(Resource):
    @api.response(200, 'Success', [fight_model])
    def get(self, id):
        fight = _fight_query().filter(Fight.id == id).first_or_404()
        return schema_for(FightSchema, _x_fields()).dump(fight)

    @admin_required
    @fight_ns.expect(update_fight_model)
    @api.response(200, 'Success', [fight_model])
    def patch(self, id):
        fight = Fight.query.get_or_404(id)
        try:
            data = request.get_json()

            if "date" in data:
                data["date"] = parse_datetime_utc(data["date"])

            if "scheduled_date" in data:
                data["scheduled_date"] = parse_datetime_utc(
                        data["scheduled_date"])

            if "status" in data:
                data["status"] = FightStatus(data["status"])

            for key, value in data.items():
                if key == 'custom_stats':
                    for stat in value:
                        if stat.get('id'):
                            custom_stat = CustomStats.query.get(stat['id'])
                            custom_stat.value = stat['value']
                        else:
                            custom_stat = CustomStats(
                                    fight_id=fight.id, **stat)
                            db.session.add(custom_stat)
                    continue
                setattr(fight, key, value)

            db.session.commit()
            log_and_return(
                    current_app.logger,
                    f'Fight {id} patched',
                    status_code=200)
            return FightSchema().dump(fight)
        except Exception as e:
            traceback.print_exc()
            return log_and_return(
                    current_app.logger,
                    f'Unexpected Error: {str(e)}',
                    'error', 500)

    @admin_required
    def delete(self, id):
        fight = Fight.query.get_or_404(id)
        try:
            custom_stats = CustomStats.query.filter_by(fight_id=id).all()
            for stat in custom_stats:
                db.session.delete(stat)

            db.session.delete(fight)
            db.session.commit()

            foldername = f"{current_app.config['FIGHTS_FOLDER']}/fight_{id}/"
            if os.path.exists(foldername):
                shutil.rmtree(foldername)
                current_app.logger.info("Fight files deleted.")
            else:
                current_app.logger.info("Fight files not found.")

            return log_and_return(
                    current_app.logger,
                    'Fight deleted',
                    status_code=204)
        except Exception as e:
            return log_and_return(
                    current_app.logger,
                    f'Unexpected Error: {str(e)}',
                    'error', 500)


@fight_ns.route('/custom_stat')
class CustomItem(Resource):
    @admin_required
    @fight_ns.expect(custom_stats_model)
    @fight_ns.marshal_with(custom_stats_model)
    def post(self):
        data = request.get_json()

        if {"fight_id", "agent_id", "name", "value"}.issubset(data):
            fight = Fight.query.get_or_404(data["fight_id"])
            if (data["agent_id"] == fight.player1_id
                    or data["agent_id"] == fight.player2_id):
                stat = CustomStats(**data)

                db.session.add(stat)
                db.session.commit()
                log_and_return(
                        current_app.logger,
                        f"CustomStat {stat.id} created",
                        status_code=201)
                return CustomStatsSchema().dump(stat), 201
            else:
                return log_and_return(
                        current_app.logger,
                        "Agent id not in the fight",
                        "warning", 400)
        else:
            return log_and_return(
                    current_app.logger,
                    "Missing information",
                    "warning", 400)


def get_fight_json(id):
    try:
        pattern_rec_ugz = r"^__REC__([0-9]+)\.json$"
        pattern_rec_gz = r"^__REC__([0-9]+)\.json.gz$"
        json_path = f"{current_app.config['FIGHTS_FOLDER']}/fight_{id}/"
        for file in os.listdir(json_path):
            if re.match(pattern_rec_gz, file):
                response = send_from_directory(
                        json_path, file,
                        download_name="data.json")
                response.headers['Content-Encoding'] = 'gzip'
                response.headers['Content-Type'] = 'application/json'
                return response
            if re.match(pattern_rec_ugz, file):
                return jsonify(json.load(open(json_path + file)))
        return log_and_return(
                current_app.logger, 'No JSON file found', "warning", 404)
    except IndexError:
        return log_and_return(
                current_app.logger, 'No JSON file found', "warning", 404)
    except Exception as e:
        return log_and_return(
                current_app.logger,
                f'Unexpected Error: {str(e)}',
                'error', 500)


@fight_ns.route('/json/<int:id>')
class FightItemJson(Resource):
    def get(self, id):
        return get_fight_json(id)


@fight_ns.route('/json/<int:id>/index.json')
class FightItemJsonAlt(Resource):
    def get(self, id):
        return get_fight_json(id)


@fight_ns.route('/log/<int:id>/')
class FightItemLog(Resource):
    @jwt_required()
    def get(self, id):
        try:
            user = get_jwt_identity()
            student = Student.query.get_or_404(user['id'])
            group = Group.query.get_or_404(student.group_id)
            group_agents = [agent.id for agent in group.agents]

            fight = Fight.query.get_or_404(id)
            user_agents = [fight.player1_id, fight.player2_id]

            if not any(agent in group_agents for agent in user_agents):
                return log_and_return(
                        current_app.logger,
                        'You are not authorized to access this fight',
                        'warning', 403)

            log_path = f"{current_app.config['FIGHTS_FOLDER']}/fight_{id}/"
            if not os.path.exists(log_path):
                return log_and_return(
                        current_app.logger,
                        'No log file found',
                        "warning", 404)

            candidates = [f for f in os.listdir(log_path)
                          if (f.endswith('.log') or f.endswith('.log.gz'))
                          and f.startswith('agent')]

            if not candidates:
                return log_and_return(
                        current_app.logger,
                        'No log file found',
                        "warning", 404)

            # prefer gz
            candidates.sort(key=lambda x: x.endswith('.log.gz'), reverse=True)
            chosen = candidates[0]

            if chosen.endswith('.log.gz'):
                download_name = chosen.split(".gz")[0]

                response = send_from_directory(
                    log_path, chosen,
                    mimetype='text/plain',
                    as_attachment=False,
                    download_name=download_name)
                response.headers['Content-Encoding'] = 'gzip'
                return response
            else:
                full_path = os.path.join(log_path, chosen)
                with open(full_path, 'r') as f:
                    return f.read()

        except Exception as e:
            return log_and_return(
                    current_app.logger,
                    f'Unexpected Error: {str(e)}',
                    'error', 500)


def get_last_fights():
    try:
        # List holding the latest matches for each agent
        latest_fights_per_agent = []

        # Get all agents
        agents = db.session.query(Agent).all()
        i = 0
        # For each agent, fetch the last 5 matches
        for agent in agents:
            # Get the last 5 matches where the agent was player 1
            fights_player1 = db.session.query(Fight).filter(
                Fight.status == FightStatus.DONE,
                Fight.player1_id == agent.id
            ).order_by(Fight.date.desc()).limit(5).all()

            # Get the last 5 matches where the agent was player 2
            fights_player2 = db.session.query(Fight).filter(
                Fight.status == FightStatus.DONE,
                Fight.player2_id == agent.id
            ).order_by(Fight.date.desc()).limit(5).all()
            i += 1
            # Add these matches to the main list
            latest_fights_per_agent.extend(fights_player1 + fights_player2)

            # Remove duplicates
            latest_fights_per_agent = list(
                    dict.fromkeys(latest_fights_per_agent))

        return latest_fights_per_agent
    except Exception as e:
        return str(e), 500


@fight_ns.route('/agent_vs_agent_stats/<int:group_id>')
class AgentVsAgentStats(Resource):
    @jwt_required()
    @api.doc(params={
        'my_agents': 'Comma-separated list of my agent IDs to filter',
        'opponent_agents': 'List of opponent agent IDs to include'
    })
    def get(self, group_id):
        try:
            # Check that the user has access to this group
            current_user = get_jwt_identity()
            student = Student.query.get(current_user['id'])
            if not student or (
                    student.group_id != group_id and student.role != 'admin'):
                return log_and_return(
                        current_app.logger,
                        'Unauthorized access',
                        'warning', 403)

            # Retrieve the filters
            my_agents = request.args.get(
                    'my_agents', '',
                    type=lambda x: [int(i) for i in x.split(',') if i])
            opponent_agents = request.args.get(
                    'opponent_agents', '',
                    type=lambda x: [int(i) for i in x.split(',') if i])

            # Get all the agents in the group
            group_agents = Agent.query.filter_by(group_id=group_id).all()
            group_agent_ids = [agent.id for agent in group_agents]

            # If no "my agents" filter is specified,
            # use all the agents in the group
            if not my_agents:
                my_agents = group_agent_ids
            else:
                # Check that the filtered agents belong to the group
                my_agents = [aid for aid in my_agents
                             if aid in group_agent_ids]

            # Build the optimized SQL query
            # Subquery for agent 1's wins
            agent1_wins_subq = select(
                Fight.player1_id.label('agent1_id'),
                Fight.player2_id.label('agent2_id'),
                func.count(Fight.id).label('agent1_wins')
            ).where(
                and_(
                    Fight.status == FightStatus.DONE,
                    Fight.winner_id == Fight.player1_id,
                    Fight.player1_id.in_(my_agents)
                )
            )

            # Apply the opposing-agents filter if specified
            if opponent_agents:
                agent1_wins_subq = agent1_wins_subq.where(
                        Fight.player2_id.in_(opponent_agents))

            agent1_wins_subq = agent1_wins_subq.group_by(
                    Fight.player1_id, Fight.player2_id).subquery()

            # Subquery for agent 2's wins
            agent2_wins_subq = select(
                Fight.player1_id.label('agent1_id'),
                Fight.player2_id.label('agent2_id'),
                func.count(Fight.id).label('agent2_wins')
            ).where(
                and_(
                    Fight.status == FightStatus.DONE,
                    Fight.winner_id == Fight.player2_id,
                    Fight.player1_id.in_(my_agents)
                )
            )

            if opponent_agents:
                agent2_wins_subq = agent2_wins_subq.where(
                        Fight.player2_id.in_(opponent_agents))

            agent2_wins_subq = agent2_wins_subq.group_by(
                    Fight.player1_id, Fight.player2_id).subquery()

            # Subquery for the total number of fights
            total_fights_subq = select(
                Fight.player1_id.label('agent1_id'),
                Fight.player2_id.label('agent2_id'),
                func.count(Fight.id).label('total_fights')
            ).where(
                and_(
                    Fight.status == FightStatus.DONE,
                    Fight.player1_id.in_(my_agents)
                )
            )

            if opponent_agents:
                total_fights_subq = total_fights_subq.where(
                        Fight.player2_id.in_(opponent_agents))

            total_fights_subq = total_fights_subq.group_by(
                    Fight.player1_id, Fight.player2_id).subquery()

            # Main query combining all the statistics
            main_query = select(
                total_fights_subq.c.agent1_id,
                total_fights_subq.c.agent2_id,
                func.coalesce(
                    agent1_wins_subq.c.agent1_wins, 0).label('agent1_wins'),
                func.coalesce(
                    agent2_wins_subq.c.agent2_wins, 0).label('agent2_wins'),
                total_fights_subq.c.total_fights
            ).select_from(
                total_fights_subq
                .outerjoin(agent1_wins_subq, and_(
                    total_fights_subq.c.agent1_id == agent1_wins_subq.c.agent1_id,
                    total_fights_subq.c.agent2_id == agent1_wins_subq.c.agent2_id
                ))
                .outerjoin(agent2_wins_subq, and_(
                    total_fights_subq.c.agent1_id == agent2_wins_subq.c.agent1_id,
                    total_fights_subq.c.agent2_id == agent2_wins_subq.c.agent2_id
                ))
            ).order_by(total_fights_subq.c.total_fights.desc())

            # Execute the query
            results = db.session.execute(main_query).fetchall()

            # Fetch the agent information for the mapping
            all_agents_in_results = set()
            for result in results:
                all_agents_in_results.add(result.agent1_id)
                all_agents_in_results.add(result.agent2_id)

            agents_info = {agent.id: agent for agent
                           in Agent.query.filter(
                               Agent.id.in_(all_agents_in_results)).all()}

            # Format the results
            agent_stats = []
            for result in results:
                if result.total_fights > 0:
                    agent_stats.append({
                        'agent1': {
                            'id': result.agent1_id,
                            'name': agents_info[result.agent1_id].name
                        },
                        'agent2': {
                            'id': result.agent2_id,
                            'name': agents_info[result.agent2_id].name
                        },
                        'agent1_wins': result.agent1_wins,
                        'agent2_wins': result.agent2_wins,
                        'total_fights': result.total_fights,
                        'winrate': round((result.agent1_wins / result.total_fights) * 100, 1) if result.total_fights > 0 else 0
                    })

            return agent_stats, 200
        except Exception as e:
            return log_and_return(
                    current_app.logger,
                    f'Error getting agent vs agent stats: {str(e)}',
                    'error', 500)


@fight_ns.route('/opponents/<int:group_id>')
class OpponentAgents(Resource):
    @jwt_required()
    def get(self, group_id):
        """
        Returns the list of agents
        that have already fought against the group's agents
        """
        try:
            # Check that the user has access to this group
            current_user = get_jwt_identity()
            student = Student.query.get(current_user['id'])
            if not student or (student.group_id != group_id
                               and student.role != 'admin'):
                return log_and_return(
                        current_app.logger,
                        'Unauthorized access',
                        'warning', 403)

            # Get all the agents in the group
            group_agents = Agent.query.filter(
                    Agent.group_id == group_id,
                    Agent.status.in_([AgentStatus.ACTIVE,
                                      AgentStatus.INACTIVE])).all()
            group_agent_ids = [agent.id for agent in group_agents]

            # Fetch all the opposing agents
            # that have fought against the group's agents
            # First part: agents in position
            # player2 contre nos agents en player1
            opponents_as_player2 = select(
                Fight.player2_id.label('opponent_id')).where(
                and_(
                    Fight.status == FightStatus.DONE,
                    Fight.player1_id.in_(group_agent_ids)
                )
            )

            # Second part: agents in position
            # player1 contre nos agents en player2
            opponents_as_player1 = select(
                Fight.player1_id.label('opponent_id')).where(
                and_(
                    Fight.status == FightStatus.DONE,
                    Fight.player2_id.in_(group_agent_ids),
                )
            )

            # Union of the two queries
            opponent_ids_query = opponents_as_player2.union(
                    opponents_as_player1)

            # Execute the query and collect the unique IDs
            opponent_ids_result = db.session.execute(
                    opponent_ids_query).fetchall()
            opponent_ids = list(set([row.opponent_id for row
                                     in opponent_ids_result]))

            # Fetch the opposing agents' information
            opponents = Agent.query.filter(
                Agent.id.in_(opponent_ids)).order_by(Agent.name.asc()).all()

            # Format the response
            return SmallAgentSchema().dump(opponents, many=True), 200
        except Exception as e:
            return log_and_return(
                    current_app.logger,
                    f'Error getting opponent agents: {str(e)}',
                    'error', 500)
