import traceback

from flask import request, current_app
from flask_restx import Resource

from backend.db import db

from backend.models.schemas import GroupSchema
from backend.models import Group, Fight
from backend.app.fields import schema_for
from backend.cache import invalidate_group_stats
from backend.app.utils import log_and_return

from backend.app.stats import (
        get_stats, get_stats_uncounted,
        get_groups_min_stats, get_groups_levd,
        get_groups_palmares)
from .api import (
    api, admin_required, group_post_model, group_model, group_with_stats_model,
    update_group_model, group_min_agents_stats_model,
    group_leagues_elo_victories_defeats_model, group_palmares_model
)

group_ns = api.namespace('groups', description='Group operations')


@group_ns.route('')
class GroupCollection(Resource):
    @admin_required
    @group_ns.expect(group_post_model)
    @group_ns.marshal_with(group_model)
    def post(self):
        try:
            data = request.get_json()
            if "name" not in data:
                return log_and_return(
                        current_app.logger,
                        "Missing information",
                        "warning", 400)

            if "id" in data and Group.query.filter_by(id=data['id']).first():
                return log_and_return(
                        current_app.logger,
                        'Group number already exists',
                        "warning", 403)

            new_group = Group(**data)
            db.session.add(new_group)
            db.session.commit()
            invalidate_group_stats(current_app.config["REDIS"])
            log_and_return(
                    current_app.logger,
                    f'Group {new_group.name} created',
                    status_code=201)
            return GroupSchema().dump(new_group), 201
        except Exception as e:
            return log_and_return(
                    current_app.logger,
                    f'Unexpected Error: {str(e)}',
                    'error', 500)

    @group_ns.marshal_list_with(group_with_stats_model)
    @api.doc(params={'include_stats': "'true' if we want to include stats"})
    def get(self):
        try:
            include_stats = request.args.get('include_stats', 'false')
            include_stats = True if include_stats == 'true' else False

            groups = Group.query.all()

            if include_stats:
                groups_with_stats = []
                for group in groups:
                    json_group = GroupSchema().dump(group)
                    stats = get_stats(group.id)
                    for key, stat in stats.items():
                        if 'per_agent' not in key:
                            json_group[key] = stat
                        else:
                            for agent in json_group['agents']:
                                if agent['id'] in stat:
                                    agent[key.rstrip('per_agent')] = stat[agent['id']]

                    uncounted_stats = get_stats_uncounted(group.id)
                    for key, stat in uncounted_stats.items():
                        for agent in json_group['agents']:
                            if agent['id'] in stat:
                                agent[key.rstrip('per_agent')] = stat[agent['id']]

                    groups_with_stats.append(json_group)

                return groups_with_stats

            return schema_for(
                    GroupSchema,
                    request.headers.get("X-Fields")).dump(groups, many=True)

        except Exception as e:
            traceback.print_exc()
            return log_and_return(
                    current_app.logger,
                    f'Unexpected Error: {str(e)}',
                    'error', 500)


@group_ns.route('/agents_min_stats')
class GroupMinStats(Resource):
    @group_ns.marshal_list_with(group_min_agents_stats_model)
    def get(self):
        return get_groups_min_stats()


@group_ns.route('/agents_min_stats.json')
class GroupMinStatsJson(Resource):
    @group_ns.marshal_list_with(group_min_agents_stats_model)
    def get(self):
        return get_groups_min_stats()


@group_ns.route('/levd')
class GroupLEVD(Resource):
    @group_ns.marshal_list_with(group_leagues_elo_victories_defeats_model)
    def get(self):
        return get_groups_levd()


@group_ns.route('/levd.json')
class GroupLEVDJson(Resource):
    @group_ns.marshal_list_with(group_leagues_elo_victories_defeats_model)
    def get(self):
        return get_groups_levd()


@group_ns.route('/palmares')
class GroupPalmares(Resource):
    @group_ns.marshal_list_with(group_palmares_model)
    def get(self):
        return get_groups_palmares()


@group_ns.route('/palmares.json')
class GroupPalmaresJson(Resource):
    @group_ns.marshal_list_with(group_palmares_model)
    def get(self):
        return get_groups_palmares()


@group_ns.route('/<int:id>')
class GroupItem(Resource):
    @group_ns.marshal_with(group_with_stats_model)
    @api.doc(params={'include_stats': "'true' if we want to include stats"})
    def get(self, id):
        group = Group.query.get_or_404(id)
        try:
            include_stats = request.args.get('include_stats', 'false')
            include_stats = True if include_stats == 'true' else False

            if include_stats:
                group_json = GroupSchema().dump(group)
                stats = get_stats(group.id)
                for key, stat in stats.items():
                    if 'per_agent' not in key:
                        group_json[key] = stat
                    else:
                        for agent in group_json['agents']:
                            if agent['id'] in stat:
                                agent[key.rstrip('per_agent')] = stat[agent['id']]

                uncounted_stats = get_stats_uncounted(group.id)
                for key, stat in uncounted_stats.items():
                    for agent in group_json['agents']:
                        if agent['id'] in stat:
                            agent[key.rstrip('per_agent')] = stat[agent['id']]

                return group_json

            return schema_for(
                    GroupSchema,
                    request.headers.get("X-Fields")).dump(group)

        except Exception as e:
            return log_and_return(
                    current_app.logger,
                    f'Unexpected Error: {str(e)}',
                    'error', 500)

    @admin_required
    @group_ns.expect(update_group_model)
    @group_ns.marshal_with(group_model)
    def patch(self, id):
        group = Group.query.get_or_404(id)
        try:
            data = request.get_json()
            group.name = data.get('name', group.name)
            if len(group.league_history) == 0:
                if data.get('league') is not None:
                    group.league_history = [data.get('league')]
            else:
                group.league_history = group.league_history[:-1] + [data.get('league', group.league_history[-1])]

            db.session.commit()
            invalidate_group_stats(current_app.config["REDIS"])
            log_and_return(
                    current_app.logger,
                    f'Group {group.name} patched',
                    status_code=200)
            return GroupSchema().dump(group)
        except Exception as e:
            return log_and_return(
                    current_app.logger,
                    f'Unexpected Error: {str(e)}',
                    'error', 500)

    @admin_required
    def delete(self, id):
        group = Group.query.get_or_404(id)
        try:
            # Check whether this group is involved in any fights
            involved_fights = db.session.query(Fight).filter((Fight.player1.has(group_id=id)) | (Fight.player2.has(group_id=id))).all()
            if involved_fights:
                return log_and_return(current_app.logger,'Attempt to delete a group involved in fights', 'warning', 403)
            db.session.delete(group)
            db.session.commit()
            invalidate_group_stats(current_app.config["REDIS"])
            return log_and_return(current_app.logger,'Group deleted', status_code=204)
        except Exception as e:
            return log_and_return(current_app.logger,f'Unexpected Error: {str(e)}', 'error', 500)
