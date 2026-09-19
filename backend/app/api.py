from functools import wraps

from flask import current_app
from flask_restx import Api, Resource
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request

from backend.models import Student, Agent, Group, CustomStats, Fight
from backend.app.utils import log_and_return

api = Api(
    default_label='CORAIL Research team', 
    default='Abyss API', 
    version='0.1', 
    title='Abyss API', 
    description='API for the Abyss project'
)

root_ns = api.namespace('')

# Api models without nested fields
custom_stats_model = api.model('CustomStats', CustomStats.custom_stats_model_dict())
custom_stats_aggregated_agent_model = api.model('CustomStatsAggAgent', CustomStats.custom_stats_aggregated_agent_model_dict())

student_model = api.model('Student', Student.student_model_dict())
student_non_admin_model = api.model('StudentNonAdmin', Student.student_non_admin_model_dict())
student_from_group_model = api.model('StudentFromGroup', Student.student_from_group_model_dict())
login_student_model = api.model('LoginStudent', Student.login_student_dict())
update_student_model = api.model('UpdateStudent', Student.update_student_dict())

agent_post_model = api.model('AgentPost', Agent.agent_model_post_dict())
agent_min_stats_model = api.model('AgentMinStats', Agent.agents_min_stats_dict())
agent_elo_victories_defeats_model = api.model('AgentEloVictoriesDefeats', Agent.agents_elo_victories_defeats_dict())
update_agent_model = api.model('UpdateAgent', Agent.update_agent_dict())

group_post_model = api.model('GroupPost', Group.group_model_dict_no_agents_no_students())
update_group_model = api.model('UpdateGroup', Group.update_group_dict())
upload_agent_model = api.model('UploadAgent', Agent.upload_agent_dict())

update_fight_model = api.model('UpdateFight', Fight.update_fight_dict())

# Api models with nested fields
agent_from_group_model = api.model('AgentFromGroup', Agent.agent_from_group_model_dict(custom_stats_model))
agent_from_group_with_stats_model = api.model('AgentFromGroupStats', Agent.agent_from_group_with_stats_model_dict(custom_stats_model))
agent_model = api.model('Agent', Agent.agent_model_dict(group_post_model, custom_stats_model))

group_model = api.model('Group', Group.group_model_dict(student_from_group_model, agent_from_group_model))
group_with_stats_model = api.model('GroupStats', Group.group_stats_model_dict(student_from_group_model, agent_from_group_with_stats_model))
group_min_agents_stats_model = api.model('GroupMinAgentStats', Group.group_agent_minimal_stats_dict(agent_min_stats_model))
group_leagues_elo_victories_defeats_model = api.model('GroupLeagueEloVictoriesDefeats', Group.group_leagues_elo_victories_defeats_dict(agent_elo_victories_defeats_model))
group_palmares_model = api.model('GroupPalmares', Group.group_palmares_dict())

fight_model = api.model('Fight', Fight.fight_model_dict(agent_model, custom_stats_model))
fight_post_model = api.model('FightPost', Fight.fight_model_post_dict(custom_stats_model))


@api.route("/health")
class HealthCheck(Resource):
    def get(self):
        return log_and_return(current_app.logger,'OK', status_code=200)
    

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if verify_jwt_in_request(optional=True) is not None:
            current_user = get_jwt_identity()
            student = Student.query.get(current_user['id'])
            if student and student.role == 'admin':
                return fn(*args, **kwargs)
        return log_and_return(current_app.logger,'Unauthorized access attempt', 'warning', 403)
    return jwt_required()(wrapper)


from . import agent, fight, arena, group, student  # noqa: E402, F401
