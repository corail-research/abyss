from marshmallow import Schema, fields

from backend.models.enums import (
        AgentStatus, FightStatus, GroupStatus, CustomStatAggregation)


class StudentSchema(Schema):
    username = fields.Str()
    group_id = fields.Int()
    role = fields.Str()


class StudentSchemaAdmin(Schema):
    username = fields.Str()
    id = fields.Int()
    group_id = fields.Int()
    password = fields.Str()
    role = fields.Str()


class AgentSchema(Schema):
    id = fields.Int()
    status = fields.Enum(AgentStatus, by_value=True)
    elo = fields.Float()
    name = fields.Str()
    group = fields.Nested('GroupSchema', only=('id', 'name', 'league_history'))
    peak_elo = fields.Int()
    refusal_message = fields.Str()
    custom_stats = fields.Nested('CustomStatsSchema', many=True)


class SmallAgentSchema(Schema):
    id = fields.Int()
    name = fields.Str()
    group_id = fields.Int()


class AgentEVDSchema(Schema):
    id = fields.Int()
    name = fields.Str()
    status = fields.Enum(AgentStatus, by_value=True)
    elo = fields.Float()
    n_victories = fields.Int()
    n_defeats = fields.Int()


class CustomStatsSchema(Schema):
    id = fields.Int()
    fight_id = fields.Int()
    agent_id = fields.Int()
    name = fields.Str()
    value = fields.Int()
    aggregation = fields.Enum(CustomStatAggregation, by_value=True)


class FightSchema(Schema):
    id = fields.Int()
    score_player1 = fields.Int()
    score_player2 = fields.Int()
    winner_id = fields.Int()
    player1_id = fields.Int()
    player2_id = fields.Int()
    date = fields.DateTime()
    player1 = fields.Nested('AgentSchema')
    player2 = fields.Nested('AgentSchema')
    status = fields.Enum(FightStatus, by_value=True)
    scheduled_date = fields.DateTime()
    custom_stats = fields.Nested('CustomStatsSchema', many=True)


class GroupSchema(Schema):
    id = fields.Int()
    name = fields.Str()
    status = fields.Enum(GroupStatus, by_value=True)
    league_history = fields.Dict()
    students = fields.Nested('StudentSchema', many=True)
    agents = fields.Nested('AgentSchema', many=True, exclude=('group','custom_stats'))


class GroupLEVDSchema(Schema):
    id = fields.Int()
    name = fields.Str()
    league = fields.Str()
    previous_league = fields.Str()
    elo = fields.Float()
    n_victories = fields.Int()
    n_defeats = fields.Int()
    agents = fields.Nested('AgentEVDSchema', many=True)


class CustomStatsAggAgentSchema(Schema):
    id = fields.Int()
    name = fields.Str()
    value = fields.Int()


class ArenaSchema(Schema):
    id = fields.Boolean()
    state = fields.Boolean()
    parallel_match = fields.Integer()

