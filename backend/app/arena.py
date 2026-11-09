from flask import request, current_app
from flask_restx import Resource

from backend.app.utils import log_and_return
from backend.db import db
from backend.models.schemas import ArenaSchema
from backend.models import Arena
from backend.runtime import set_arena_enabled

from backend.app.api import api, admin_required

arena_ns = api.namespace('arena', description="Arena operations")

arena_state_model = arena_ns.model('Arena', Arena.arena_state_dict())


@arena_ns.route("")
class ArenaState(Resource):
    @admin_required
    @arena_ns.marshal_with(arena_state_model)
    def get(self):
        arena = Arena.query.get_or_404(True)
        return ArenaSchema().dump(arena)

    @admin_required
    @arena_ns.expect(arena_state_model)
    @arena_ns.marshal_with(arena_state_model)
    def patch(self):
        arena = Arena.query.get_or_404(True)
        try:
            data = request.get_json()

            if data.get("state") is not None:
                arena.state = bool(data.get("state"))
            if data.get("parallel_match") is not None:
                arena.parallel_match = int(data.get("parallel_match"))
            db.session.commit()

            set_arena_enabled(current_app.config["REDIS"], arena.state)
            return ArenaSchema().dump(arena)

        except Exception as e:
            return log_and_return(
                    current_app.logger, f'Unexpected Error: {str(e)}',
                    'error', 500)
