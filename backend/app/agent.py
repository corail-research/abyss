import shutil
import pandas as pd
import os
import traceback
import zipfile

from io import BytesIO

from flask import request, current_app, send_file
from flask_restx import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload

from backend.db import db
from backend.models.enums import AgentStatus
from backend.models.schemas import AgentSchema
from backend.models import Student, Group, Fight, Agent
from backend.app.fields import schema_for
from backend.app.utils import (
        is_right_extension, process_zip_file, log_and_return)
from backend.app.stats import get_stats, get_stats_uncounted
from backend.app.api import (
        api, admin_required, agent_post_model, agent_model,
        agent_from_group_with_stats_model, update_agent_model,
        upload_agent_model)

agent_ns = api.namespace('agents', description='Agent operations')


@agent_ns.route('')
class AgentCollection(Resource):
    @admin_required
    @agent_ns.expect(agent_post_model)
    @agent_ns.marshal_with(agent_model)
    def post(self):
        try:
            data = request.get_json()
            if "id" in data and Agent.query.filter_by(id=data['id']).first():
                return 'Agent number already exists', 403

            data["status"] = AgentStatus(data["status"])
            group = Group.query.get(data['group_id'])
            if group:
                del data['group_id']
                data['group'] = group
                new_agent = Agent(**data)
                db.session.add(new_agent)
                db.session.commit()
                log_and_return(current_app.logger,
                               f'Agent {new_agent.name} created',
                               status_code=201)
                return AgentSchema().dump(new_agent), 201
            else:
                return log_and_return(
                        current_app.logger,
                        'Attempt to create an agent in a non-existing group',
                        'warning', 403)
        except Exception as e:
            return log_and_return(current_app.logger,
                                  f'Unexpected Error: {str(e)}', 'error',
                                  500)

    @agent_ns.marshal_list_with(agent_model)
    @api.doc(params={'paginate': "'true' if we want to paginate the results",
                     'page': 'Page number',
                     'limit': 'Number of items per page',
                     'status': 'Agents status'})
    def get(self):
        try:
            paginate = request.args.get('paginate', 'false')
            paginate = True if paginate == 'true' else False
            page = request.args.get('page', 1, type=int)
            limit = request.args.get('limit', 20, type=int)
            status = request.args.get(
                    'status', [],
                    type=lambda x: x.split(','))
            agent_ids = request.args.get(
                    'agent_ids', [], type=lambda x: x.split(','))

            real_status = []
            for s in status:
                if not AgentStatus.has_value(s):
                    return log_and_return(
                            current_app.logger,
                            f"Unknown status: {s}", "warning")
                real_status.append(AgentStatus(s))

            real_ids = []
            for s in agent_ids:
                if not s.isnumeric():
                    return log_and_return(
                            current_app.logger,
                            f"Unknown id: {s}", "warning")
                real_ids.append(int(s))

            query = (Agent.query
                     .options(joinedload(Agent.group))
                     .order_by(Agent.id.desc()))

            if len(real_status) > 0:
                query = query.filter(Agent.status.in_(real_status))

            if len(real_ids) > 0:
                query = query.filter(Agent.id.in_(real_ids))

            if paginate:
                query = query.paginate(
                        page=page, per_page=limit, error_out=False)

            return schema_for(
                    AgentSchema,
                    request.headers.get("X-Fields")).dump(query, many=True)

        except Exception as e:
            return log_and_return(
                    current_app.logger,
                    f'Unexpected Error: {str(e)}',
                    'error', 500)


@agent_ns.route('/count')
class CountAgent(Resource):
    @api.doc(params={'status': 'Agents status'})
    def get(self):
        status = request.args.get('status', [], type=lambda x: x.split(','))

        real_status = []
        for s in status:
            if not AgentStatus.has_value(s):
                return log_and_return(
                        current_app.logger,
                        f"Unknown status: {s}",
                        "warning")
            real_status.append(AgentStatus(s))

        query = Agent.query

        if len(real_status) > 0:
            query = query.filter(Agent.status.in_(real_status))

        return query.count()


@agent_ns.route('/group/<int:group_id>')
class AgentGroup(Resource):
    @agent_ns.marshal_list_with(agent_from_group_with_stats_model)
    @api.doc(params={'paginate': 'Boolean indicating if we want to paginate the results or not', 
                     'page': 'Page number', 
                     'limit': 'Number of items per page',
                     'status': 'Agents status',
                     'include_stats': 'Boolean indicating if we want to include stats or not'})
    def get(self, group_id):
        paginate = request.args.get('paginate', 'false')
        paginate = True if paginate == 'true' else False

        include_stats = request.args.get('include_stats', 'false')
        include_stats = True if include_stats == 'true' else False

        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)

        status = request.args.get('status', [], type=lambda x: x.split(","))

        real_status = []
        for s in status:
            if not AgentStatus.has_value(s):
                return log_and_return(
                        current_app.logger,
                        f"Unknown status: {s}",
                        "warning")
            real_status.append(AgentStatus(s))

        query = (Agent.query
                 .options(joinedload(Agent.group))
                 .filter(Agent.group_id == group_id)
                 .order_by(Agent.id.desc()))

        if len(real_status) > 0:
            query = query.filter(Agent.status.in_(real_status))

        if paginate:
            query = query.paginate(page=page, per_page=limit, error_out=False)

        if include_stats:
            # Full schema on purpose: the per-agent stats are merged by id.
            agents = AgentSchema().dump(query, many=True)

            stats = get_stats(group_id)
            for key, stat in stats.items():
                if 'per_agent' in key:
                    for agent in agents:
                        if agent["id"] in stat:
                            agent[key.rstrip('per_agent')] = stat[agent['id']]

            uncounted_stats = get_stats_uncounted(group_id)
            for key, stat in uncounted_stats.items():
                for agent in agents:
                    if agent['id'] in stat:
                        agent[key.rstrip('per_agent')] = stat[agent['id']]

            return agents

        return schema_for(
                AgentSchema,
                request.headers.get("X-Fields")).dump(query, many=True)


@agent_ns.route('/<int:id>')
class AgentItem(Resource):
    @agent_ns.marshal_with(agent_model)
    def get(self, id):
        agent = Agent.query.get_or_404(id)
        return schema_for(
                AgentSchema,
                request.headers.get("X-Fields")).dump(agent)

    @admin_required
    @agent_ns.expect(update_agent_model)
    @agent_ns.marshal_with(agent_model)
    def patch(self, id):
        agent = Agent.query.get_or_404(id)
        name_max_len = current_app.config["AGENT_NAME_MAX_LENGTH"]
        try:
            data = request.get_json()
            for key, value in data.items():
                if (key == 'name' and
                        len(value) > name_max_len):
                    return log_and_return(
                            current_app.logger,
                            f"Agent name cannot exceed {name_max_len} "
                            "characters",
                            "warning", 400)
                if key == 'status':
                    value = AgentStatus(value)
                if key == 'group_id':
                    old_group = agent.group_id
                    old_fname = f'{current_app.config["UPLOAD_FOLDER"]}/group_{old_group}/agent_{id}'
                    new_fname = f'{current_app.config["UPLOAD_FOLDER"]}/group_{value}/agent_{id}'
                    if not os.path.exists(new_fname):
                        os.makedirs(new_fname)
                    os.rename(old_fname, new_fname)
                setattr(agent, key, value)

            db.session.commit()
            log_and_return(
                    current_app.logger,
                    f'Agent {agent.name} patched',
                    status_code=200)
            return AgentSchema().dump(agent)

        except Exception as e:
            return log_and_return(
                    current_app.logger,
                    f'Unexpected Error: {str(e)}',
                    'error', 500)

    @admin_required
    def delete(self, id):
        agent = Agent.query.get_or_404(id)
        try:
            foldername = f'{current_app.config["UPLOAD_FOLDER"]}/group_{agent.group_id}/agent_{agent.id}/'
            if os.path.exists(foldername):
                shutil.rmtree(foldername)
                current_app.logger.info("Agent files removed.")
            else:
                current_app.logger.info("Agent files not found.")
            
            # Check whether this agent is involved in any fights
            # TODO Delete the agent's files

            involved_fights = db.session.query(Fight).filter((Fight.player1_id == id) | (Fight.player2_id == id)).all()
            if involved_fights:  
                agent.status = AgentStatus.DELETED
                db.session.commit()
                return log_and_return(current_app.logger,f'Agent {agent.name} set to invisible', status_code=204)
            else:
                db.session.delete(agent)
                db.session.commit()
                return log_and_return(current_app.logger,f'Agent {agent.name} deleted', status_code=204)
            
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return log_and_return(current_app.logger,f'Unexpected Error: {str(e)}', 'error', 500)

@agent_ns.route('/<int:id>/toggleActive')
class AgentToggleActive(Resource):
    @jwt_required()
    @agent_ns.marshal_with(agent_model)
    def put(self, id):
        user_id = get_jwt_identity()['id']
        agent = Agent.query.get_or_404(id)
        group = Group.query.get_or_404(agent.group_id)
        try:
            if user_id not in [student.id for student in group.students]:
                return log_and_return(current_app.logger,f'Attempt to toggle the status of an agent which does not belong to the user {user_id}', 'warning', 403)
            if agent.status == AgentStatus.ACTIVE:
                agent.status = AgentStatus.INACTIVE
                db.session.commit()
            elif agent.status == AgentStatus.INACTIVE and len([a for a in group.agents if a.status == AgentStatus.ACTIVE]) < 2:
                agent.status = AgentStatus.ACTIVE
                db.session.commit()

            log_and_return(current_app.logger,f'Agent {agent.name} set to {agent.status}', status_code=200)
            return AgentSchema().dump(agent)

        except Exception as e:
            return log_and_return(current_app.logger,f'Unexpected Error: {str(e)}', 'error', 500)

@agent_ns.route('/<int:id>/deleteAgent')
class AgentDelete(Resource):
    @jwt_required()
    def put(self, id):
        user_id = get_jwt_identity()['id']
        agent = Agent.query.get_or_404(id)
        group = Group.query.get(agent.group_id)
        try:
            if user_id not in [student.id for student in group.students]:
                return log_and_return(current_app.logger,'Attempt to delete an agent which does not belong to the user', 'warning', 403)

            involved_fights = db.session.query(Fight).filter((Fight.player1_id == id) | (Fight.player2_id == id)).all()
            if involved_fights:  
                agent.status = AgentStatus.DELETED
                db.session.commit()
                return log_and_return(current_app.logger,f'Agent {agent.name} set to invisible', status_code=204)
            else:
                db.session.delete(agent)
                db.session.commit()
            
                return log_and_return(current_app.logger,f'Agent {agent.name} deleted', status_code=204)
            
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return log_and_return(current_app.logger,f'Unexpected Error: {str(e)}', 'error', 500)
        
@agent_ns.route('/loadCSV')
class AgentLoadCSV(Resource):
    @admin_required
    def post(self):
        try:
            file = request.files['file']
            new_agents = []
            if file and file.filename and file.filename.endswith('.csv'):
                df = pd.read_csv(file.stream, sep=',')
                for _, row in df.iterrows():
                    data = {
                        'name': row['name'],
                        'group_id': row['group_id'],
                        'status': AgentStatus(row['status']),
                        'refusal_message': row['refusal_message']
                    }
                    group = Group.query.get(data['group_id'])
                    if group:
                        new_agents.append(Agent(**data))
                    else:
                        return log_and_return(current_app.logger,'Attempt to create an agent in a non-existing group', 'warning', 403)
                
                db.session.add_all(new_agents)
                db.session.commit()

                log_and_return(current_app.logger,'Agent CSV loaded', status_code=201)
                return AgentSchema().dump(new_agents, many=True), 201
            else:
                return log_and_return(current_app.logger,'Invalid file type.', 'warning', 403)
        except Exception as e:
            return log_and_return(current_app.logger,f'Unexpected Error: {str(e)}', 'error', 500)

@agent_ns.route('/<int:id>/download')
class AgentDownload(Resource):
    @jwt_required()
    def get(self, id):
        user = get_jwt_identity()
        agent = Agent.query.get_or_404(id)
        group = Group.query.get(agent.group_id)
        if user['id'] not in [student.id for student in group.students]:
            return log_and_return(current_app.logger,'Attempt to download an agent which does not belong to the user', 'warning', 403)
        foldername = f'{current_app.config["UPLOAD_FOLDER"]}/group_{agent.group_id}/agent_{agent.id}/'
        if os.path.exists(foldername):
            zip_buffer = BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w') as zipf:
                for root, _, files in os.walk(foldername):
                    for file in files:
                        zipf.write(os.path.join(root, file), os.path.relpath(os.path.join(root, file), foldername))
            zip_buffer.seek(0)
            return send_file(
                zip_buffer,
                download_name=f'{agent.name}.zip',
                as_attachment=True
            )

        else:
            return log_and_return(current_app.logger,'Agent files not found', 'warning', 404)
        
@agent_ns.route('/upload')
class AgentUpload(Resource):
    @jwt_required()
    @agent_ns.expect(upload_agent_model)
    def post(self):
        if 'file' not in request.files:
            return log_and_return(current_app.logger,"Missing file to upload", "warning")
        file = request.files['file']

        if file.filename == '':
            return log_and_return(current_app.logger,"Uploaded file is not conform", "warning")
        
        data = request.form.to_dict()
        
        # Agent name validation
        if 'name' not in data or not data['name']:
            return log_and_return(current_app.logger,"Agent name is required", "warning", 400)
        
        if len(data['name']) > current_app.config["AGENT_NAME_MAX_LENGTH"]:
            return log_and_return(current_app.logger,
                                  f"Agent name cannot exceed {current_app.config['AGENT_NAME_MAX_LENGTH']} characters",
                                  "warning", 400)
        
        user = get_jwt_identity()
        student = Student.query.get(user['id'])
        log_and_return(current_app.logger,f"{student} found")
        if student.group_id != int(data['group_id']):
            return log_and_return(current_app.logger,'Attempt to upload an agent in a group that does not belong to the user', 'warning', 403)

        if (file and any(is_right_extension(file.filename, ext) for ext in current_app.config['ALLOWED_EXTENSIONS'])):
            agent = Agent(**data)
            db.session.add(agent)
            db.session.commit()

            foldername = f'{current_app.config["UPLOAD_FOLDER"]}/group_{data["group_id"]}/agent_{agent.id}/'
            if not os.path.exists(foldername):
                os.makedirs(foldername)
            if process_zip_file(file, foldername, f"agent_{agent.id}", current_app.logger):
                current_app.config["REDIS"].lpush("ABYSS_VERIFIER_QUEUE", str(agent.id))
                log_and_return(current_app.logger,f'Agent {agent.name} uploaded', status_code=201)
                return AgentSchema().dump(agent), 201
            else:
                db.session.delete(agent)
                db.session.commit()
                shutil.rmtree(foldername)
                return log_and_return(current_app.logger,f'Zip {agent.name} was malformed, please read the indications before upload', "warning")
        else:
            return log_and_return(current_app.logger,'Invalid file type.', 'warning', 403)
        
@agent_ns.route('/quarantine/<int:agent_id>')
class AgentQuarantine(Resource):
    @admin_required
    @agent_ns.marshal_with(agent_model)
    def patch(self, agent_id):
        """Place an agent in quarantine"""
        try:
            agent = Agent.query.get_or_404(agent_id)
            data = request.get_json()
            
            reason = data.get('reason', 'Agent placed in quarantine by admin')
            
            from .utils import quarantine_agent
            if quarantine_agent(agent, reason):
                log_and_return(current_app.logger, f'Agent {agent.name} placed in quarantine: {reason}', status_code=200)
                return AgentSchema().dump(agent), 200
            else:
                return log_and_return(current_app.logger, 'Failed to place agent in quarantine', 'error', 500)
                
        except Exception as e:
            return log_and_return(current_app.logger, f'Unexpected Error: {str(e)}', 'error', 500)

    @admin_required
    @agent_ns.marshal_with(agent_model)
    def delete(self, agent_id):
        """Release an agent from quarantine (set it back to inactive status)"""
        try:
            agent = Agent.query.get_or_404(agent_id)
            
            if agent.status != AgentStatus.QUARANTINE:
                return log_and_return(current_app.logger, f'Agent {agent.name} is not in quarantine', 'warning', 400)
            
            agent.status = AgentStatus.INACTIVE
            agent.refusal_message = None
            db.session.commit()
            
            log_and_return(current_app.logger, f'Agent {agent.name} removed from quarantine', status_code=200)
            return AgentSchema().dump(agent), 200
            
        except Exception as e:
            return log_and_return(current_app.logger, f'Unexpected Error: {str(e)}', 'error', 500)

@agent_ns.route('/quarantine/bulk')
class AgentQuarantineBulk(Resource):
    @admin_required
    def patch(self):
        """Mettre plusieurs agents en quarantaine"""
        try:
            data = request.get_json()
            agent_ids = data.get('agent_ids', [])
            reason = data.get('reason', 'Agents placed in quarantine by admin')
            
            if not agent_ids:
                return log_and_return(current_app.logger, 'No agent IDs provided', 'warning', 400)
            
            from .utils import quarantine_agents_by_ids
            quarantined_agents = quarantine_agents_by_ids(agent_ids, reason)
            
            log_and_return(current_app.logger, f'{len(quarantined_agents)} agents placed in quarantine', status_code=200)
            return {
                'quarantined_count': len(quarantined_agents),
                'quarantined_agents': [agent.id for agent in quarantined_agents]
            }, 200
            
        except Exception as e:
            return log_and_return(current_app.logger, f'Unexpected Error: {str(e)}', 'error', 500)

    @admin_required  
    def delete(self):
        """Sortir plusieurs agents de quarantaine"""
        try:
            data = request.get_json()
            agent_ids = data.get('agent_ids', [])
            
            if not agent_ids:
                return log_and_return(current_app.logger, 'No agent IDs provided', 'warning', 400)
            
            released_agents = []
            for agent_id in agent_ids:
                agent = Agent.query.get(agent_id)
                if agent and agent.status == AgentStatus.QUARANTINE:
                    agent.status = AgentStatus.INACTIVE
                    agent.refusal_message = None
                    released_agents.append(agent)
            
            db.session.commit()
            
            log_and_return(current_app.logger, f'{len(released_agents)} agents removed from quarantine', status_code=200)
            return {
                'released_count': len(released_agents),
                'released_agents': [agent.id for agent in released_agents]
            }, 200
            
        except Exception as e:
            return log_and_return(current_app.logger, f'Unexpected Error: {str(e)}', 'error', 500)

@agent_ns.route('/invalid/<int:agent_id>')
class AgentInvalid(Resource):
    @admin_required
    @agent_ns.marshal_with(agent_model)
    def patch(self, agent_id):
        """Mark an agent as invalid"""
        try:
            agent = Agent.query.get_or_404(agent_id)
            data = request.get_json()
            
            reason = data.get('reason', 'Agent marked as invalid by admin')
            
            agent.status = AgentStatus.INVALID
            agent.refusal_message = reason
            db.session.commit()
            
            log_and_return(current_app.logger, f'Agent {agent.name} marked as invalid: {reason}', status_code=200)
            return AgentSchema().dump(agent), 200
                
        except Exception as e:
            return log_and_return(current_app.logger, f'Unexpected Error: {str(e)}', 'error', 500)

@agent_ns.route('/invalid/bulk')
class AgentInvalidBulk(Resource):
    @admin_required
    def patch(self):
        """Marquer plusieurs agents comme invalid"""
        try:
            data = request.get_json()
            agent_ids = data.get('agent_ids', [])
            reason = data.get('reason', 'Agents marked as invalid by admin')
            
            if not agent_ids:
                return log_and_return(current_app.logger, 'No agent IDs provided', 'warning', 400)
            
            invalid_agents = []
            for agent_id in agent_ids:
                agent = Agent.query.get(agent_id)
                if agent:
                    agent.status = AgentStatus.INVALID
                    agent.refusal_message = reason
                    invalid_agents.append(agent)
            
            db.session.commit()
            
            log_and_return(current_app.logger, f'{len(invalid_agents)} agents marked as invalid', status_code=200)
            return {
                'invalid_count': len(invalid_agents),
                'invalid_agents': [agent.id for agent in invalid_agents]
            }, 200
            
        except Exception as e:
            return log_and_return(current_app.logger, f'Unexpected Error: {str(e)}', 'error', 500)
