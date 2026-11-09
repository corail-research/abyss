from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.ext.mutable import MutableDict

from flask import current_app  # noqa: F401
from flask_bcrypt import Bcrypt
from flask_restx import fields as restx_fields

from backend.db import db
from backend.models.enums import (
        AgentStatus, GroupStatus, FightStatus, CustomStatAggregation)


bcrypt = Bcrypt()


class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'),
                         nullable=False, index=True)
    role = db.Column(db.String(64), nullable=False, default='student')

    def __repr__(self):
        return f'<Student {self.id} : \n\t username: {self.username} \n\t \
                student_number: {self.id} \\n\t group_id: {self.group_id} >'

    @staticmethod
    def student_model_dict():
        return {
            'username': restx_fields.String,
            'id': restx_fields.Integer,
            'group_id': restx_fields.Integer,
            'password': restx_fields.String,
            'role': restx_fields.String
        }

    @staticmethod
    def student_non_admin_model_dict():
        return {
            'username': restx_fields.String,
            'group_id': restx_fields.Integer,
            'role': restx_fields.String
        }

    @staticmethod
    def student_from_group_model_dict():
        return {
            'username': restx_fields.String,
            'role': restx_fields.String
        }

    @staticmethod
    def login_student_dict():
        return {
            'id': restx_fields.Integer(
                description='Student ID', required=True),
            'password': restx_fields.String(
                description='Student password', required=True)
        }

    @staticmethod
    def update_student_dict():
        return {
            'username': restx_fields.String(
                description='Username of the student', required=False),
            'group_id': restx_fields.Integer(
                description='Group ID', required=False),
            'password': restx_fields.String(
                description='Password of the student', required=False)
        }


class CustomStats(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fight_id = db.Column(db.Integer, db.ForeignKey('fight.id'), nullable=False)
    agent_id = db.Column(db.Integer, db.ForeignKey('agent.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    value = db.Column(db.Integer, nullable=False)
    aggregation = db.Column(
            db.Enum(CustomStatAggregation),
            default=CustomStatAggregation.SUM, nullable=False)

    def __repr__(self):
        return f'<CustomStats {self.id} : {self.name}={self.value}>'

    @staticmethod
    def custom_stats_model_dict():
        return {
            'id': restx_fields.Integer,
            'fight_id': restx_fields.Integer,
            'agent_id': restx_fields.Integer,
            'name': restx_fields.String,
            'value': restx_fields.Integer,
            'aggregation': restx_fields.String(
                enum=['sum', 'mean', 'min', 'max']),
        }

    @staticmethod
    def custom_stats_aggregated_agent_model_dict():
        return {
            'id': restx_fields.Integer,
            'name': restx_fields.String,
            'value': restx_fields.Integer
        }


class Agent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # Only restrict the name size on the backend side and not the database
    name = db.Column(db.String(500), nullable=False)
    elo = db.Column(db.Float, default=1000.0)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'),
                         nullable=False, index=True)
    status = db.Column(
            db.Enum(AgentStatus), default=AgentStatus.PENDING, nullable=False)
    peak_elo = db.Column(db.Integer, default=1000.0)
    refusal_message = db.Column(db.String(5000), nullable=True)
    custom_stats = db.relationship('CustomStats', lazy=True)

    def __repr__(self):
        return (f'<Agent {self.id} : \n\t status : {self.status}  \n\t \n\t '
                f'elo: {self.elo} \n\t group_id: {self.group_id} '
                f'\n\t name: {self.name} \n\t >')

    @staticmethod
    def agent_model_post_dict():
        return {
            'id': restx_fields.Integer,
            'status': restx_fields.String(
                enum=['pending', 'deleted', 'invalid',
                      'active', 'inactive', 'quarantine']),
            'elo': restx_fields.Float,
            'name': restx_fields.String,
            'group_id': restx_fields.Integer,
            'peak_elo': restx_fields.Integer,
            'refusal_message': restx_fields.String
        }

    @staticmethod
    def agent_model_dict(group_dict, custom_stats):
        return {'id': restx_fields.Integer,
                'status': restx_fields.String(
                    enum=['pending', 'deleted', 'invalid',
                          'active', 'inactive', 'quarantine']),
                'elo': restx_fields.Float,
                'name': restx_fields.String,
                'group': restx_fields.Nested(group_dict),
                'peak_elo': restx_fields.Integer,
                'refusal_message': restx_fields.String,
                'custom_stats': restx_fields.List(
                    restx_fields.Nested(custom_stats))}

    @staticmethod
    def agent_from_group_model_dict(custom_stats):
        return {'id': restx_fields.Integer,
                'status': restx_fields.String(
                    enum=['pending', 'deleted', 'invalid',
                          'active', 'inactive', 'quarantine']),
                'elo': restx_fields.Float,
                'name': restx_fields.String,
                'peak_elo': restx_fields.Integer,
                'refusal_message': restx_fields.String,
                'custom_stats': restx_fields.List(
                    restx_fields.Nested(custom_stats))}

    @staticmethod
    def agent_from_group_with_stats_model_dict(custom_stats):
        return {
            'id': restx_fields.Integer,
            'status': restx_fields.String(
                enum=['pending', 'deleted', 'invalid',
                      'active', 'inactive', 'quarantine']),
            'elo': restx_fields.Float,
            'name': restx_fields.String,
            'peak_elo': restx_fields.Integer,
            'refusal_message': restx_fields.String,
            'n_victories': restx_fields.Integer,
            'n_defeats': restx_fields.Integer,
            'n_points_scored': restx_fields.Integer,
            'n_points_conceded': restx_fields.Integer,
            'custom_stats': restx_fields.List(
                restx_fields.Nested(custom_stats))
        }

    @staticmethod
    def agents_min_stats_dict():
        return {
            'id': restx_fields.Integer,
            'name': restx_fields.String,
            'n_victories': restx_fields.Integer,
            'n_defeats': restx_fields.Integer,
            'n_points_scored': restx_fields.Integer,
            'n_points_conceded': restx_fields.Integer,
        }

    @staticmethod
    def agents_elo_victories_defeats_dict():
        return {
            'name': restx_fields.String,
            'status': restx_fields.String(
                enum=['pending', 'deleted', 'invalid', 'active', 'inactive']),
            'elo': restx_fields.Float,
            'n_victories': restx_fields.Integer,
            'n_defeats': restx_fields.Integer,
        }

    @staticmethod
    def update_agent_dict():
        return {
            'active': restx_fields.Boolean(
                description='Active status of the agent', required=False),
            'group_id': restx_fields.Integer(
                description='Group ID', required=False),
            'name': restx_fields.String(
                description='Name of the agent', required=False),
            'refusal_message': restx_fields.String(
                description='Message of refusal of the agent', required=False),
            'status': restx_fields.String(
                description='Status of the agent', required=False)
        }

    @staticmethod
    def upload_agent_dict():
        return {
            'group_id': restx_fields.Integer(description='Group ID'),
            'name': restx_fields.String(description='Agent name'),
            'file': restx_fields.Raw(description='File to upload')
        }


class Fight(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.Enum(FightStatus),
                       default=FightStatus.SCHEDULED,
                       nullable=False,
                       index=True)
    score_player1 = db.Column(db.Integer, nullable=True)
    score_player2 = db.Column(db.Integer, nullable=True)
    winner_id = db.Column(db.Integer,
                          db.ForeignKey('agent.id'),
                          nullable=True,
                          index=True)
    player1_id = db.Column(db.Integer,
                           db.ForeignKey('agent.id'),
                           nullable=False,
                           index=True)
    player2_id = db.Column(db.Integer,
                           db.ForeignKey('agent.id'),
                           nullable=False,
                           index=True)
    player1 = db.relationship('Agent', foreign_keys=[player1_id])
    player2 = db.relationship('Agent', foreign_keys=[player2_id])
    date = db.Column(db.DateTime(timezone=True), nullable=True)
    scheduled_date = db.Column(db.DateTime(timezone=True), nullable=True)
    custom_stats = db.relationship('CustomStats', lazy=True)

    def __repr__(self):
        return f'<Fight {self.id} : \n\tstatus : {self.status}'

    @staticmethod
    def fight_model_dict(restx_agent_model, custom_stats):
        return {'id': restx_fields.Integer,
                'score_player1': restx_fields.Integer,
                'score_player2': restx_fields.Integer,
                'winner_id': restx_fields.Integer,
                'player1_id': restx_fields.Integer,
                'player2_id': restx_fields.Integer,
                'player1': restx_fields.Nested(restx_agent_model),
                'player2': restx_fields.Nested(restx_agent_model),
                'date': restx_fields.DateTime(dt_format='iso'),
                'status': restx_fields.String(
                    enum=['scheduled', 'done', 'in_progress', 'cancelled']),
                'scheduled_date': restx_fields.DateTime(dt_format='iso'),
                'custom_stats': restx_fields.List(
                    restx_fields.Nested(custom_stats))}

    @staticmethod
    def fight_model_post_dict(custom_stats):
        return {'id': restx_fields.Integer,
                'score_player1': restx_fields.Integer,
                'score_player2': restx_fields.Integer,
                'winner_id': restx_fields.Integer,
                'player1_id': restx_fields.Integer,
                'player2_id': restx_fields.Integer,
                'date': restx_fields.DateTime(dt_format='iso'),
                'status': restx_fields.String(
                    enum=['scheduled', 'done', 'in_progress', 'cancelled']),
                'scheduled_date': restx_fields.DateTime(dt_format='iso'),
                'custom_stats': restx_fields.List(
                    restx_fields.Nested(custom_stats))}

    @staticmethod
    def update_fight_dict():
        return {
            'player1_id': restx_fields.Integer(
                description='ID of the first player', required=False),
            'player2_id': restx_fields.Integer(
                description='ID of the second player', required=False),
            'score_player1': restx_fields.Integer(
                description='Score of the first player', required=False),
            'score_player2': restx_fields.Integer(
                description='Score of the second player', required=False),
            'winner_id': restx_fields.Integer(
                description='ID of the winner', required=False),
            'status': restx_fields.String(
                description='Status of the fight', required=False),
            'custom_stats': restx_fields.Raw(
                description='Custom statistics of the fight', required=False)
        }


class LeagueHistory(restx_fields.Raw):
    __schema_example__ = {
        "best_league": 0,
        "worst_league": 0,
        "current_league": "string",
        "previous_league": "string"
    }


class Group(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    status = db.Column(db.Enum(GroupStatus),
                       default=GroupStatus.ACTIVE,
                       nullable=False)
    league_history = db.Column(
            MutableDict.as_mutable(JSON),
            nullable=False,
            default={"best_league": 0, "worst_league": 0,
                     "current_league": "no_league",
                     "previous_league": "no_league"})
    students = db.relationship('Student', backref='group', lazy=True)
    agents = db.relationship('Agent', backref='group', lazy=True)

    def __repr__(self):
        return (f'<Group {self.id} : \n\t name: {self.name} \n\t '
                f'students: {self.students} \n\t agents: {self.agents} \n\t '
                f'league: {self.league_history["current_league"]}')

    @staticmethod
    def group_model_dict(restx_student_model, restx_agent_model):
        return {'id': restx_fields.Integer,
                'name': restx_fields.String,
                'status': restx_fields.String,
                'league_history': LeagueHistory(),
                'students': restx_fields.Nested(
                    restx_student_model, as_list=True),
                'agents': restx_fields.Nested(
                    restx_agent_model, as_list=True, exclude=('group',))}

    @staticmethod
    def group_stats_model_dict(student_model, agent_model):
        return {
            'id': restx_fields.Integer,
            'name': restx_fields.String,
            'status': restx_fields.String,
            'league_history': LeagueHistory(),
            'students': restx_fields.Nested(student_model, as_list=True),
            'agents': restx_fields.Nested(
                agent_model, as_list=True, exclude=('group',)),
            'n_victories': restx_fields.Integer,
            'n_defeats': restx_fields.Integer,
            'elo': restx_fields.Integer,
            'peak_elo': restx_fields.Integer,
            'largest_win_streak': restx_fields.Integer,
            'largest_loosing_streak': restx_fields.Integer,
            'n_points_scored': restx_fields.Integer,
            'n_points_conceded': restx_fields.Integer,
            'custom_stats': restx_fields.Raw()
        }

    @staticmethod
    def group_model_dict_no_agents_no_students():
        return {
            'id': restx_fields.Integer,
            'name': restx_fields.String,
            'status': restx_fields.String,
            'league_history': LeagueHistory()
        }

    @staticmethod
    def group_agent_minimal_stats_dict(agents_min_stats_model):
        return {
            'id': restx_fields.Integer,
            'name': restx_fields.String,
            'agents': restx_fields.Nested(
                agents_min_stats_model, as_list=True, exclude=('group',)),
        }

    @staticmethod
    def group_leagues_elo_victories_defeats_dict(
            agents_elo_victories_defeats_stats_model):
        return {
            'id': restx_fields.Integer,
            'name': restx_fields.String,
            'league': restx_fields.String,
            'previous_league': restx_fields.String,
            'n_victories': restx_fields.Integer,
            'n_defeats': restx_fields.Integer,
            'elo': restx_fields.Float,
            'agents': restx_fields.Nested(
                agents_elo_victories_defeats_stats_model,
                as_list=True, exclude=('group',)),
        }

    @staticmethod
    def group_palmares_dict():
        return {
            'id': restx_fields.Integer,
            'name': restx_fields.String,
            'elo': restx_fields.Integer,
            'n_victories': restx_fields.Integer,
            'n_defeats': restx_fields.Integer,
            'n_days_in_best_league': restx_fields.Integer,
            'n_days_in_worst_league': restx_fields.Integer,
            'largest_win_streak': restx_fields.Integer,
            'largest_loosing_streak': restx_fields.Integer,
            'n_points_scored': restx_fields.Integer,
            'n_points_conceded': restx_fields.Integer,
            'custom_stats': restx_fields.Raw()
        }

    @staticmethod
    def update_group_dict():
        return {
            'name': restx_fields.String(
                description='Name of the group', required=False),
            'league': restx_fields.String(
                description='League of the group', required=False),
        }


class Arena(db.Model):
    id = db.Column(db.Boolean, primary_key=True, default=True)
    state = db.Column(db.Boolean, nullable=False)
    parallel_match = db.Column(db.Integer, nullable=False)

    __table_args__ = (
        db.CheckConstraint(id, name='check_single_row'),
        db.CheckConstraint(parallel_match >= 1, name='check_match_positive'),
    )

    def __repr__(self):
        return f'<Arena : \n\t state: {self.state} \n\t \
                parallel_match: {self.parallel_match} >'

    @staticmethod
    def arena_state_dict():
        return {
            "state": restx_fields.Boolean,
            "parallel_match": restx_fields.Integer
        }
