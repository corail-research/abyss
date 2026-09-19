from flask_frozen import Freezer

from backend.app import create_app
from backend.app.models import Fight
from backend.app.models.enums import FightStatus

from os.path import dirname, join

# Encapsulate the app inside the URL freezer
app = create_app(freeze=True, freeze_dest=join(dirname(__file__), "public", "api"))
freezer = Freezer(app, with_no_argument_rules=False, log_url_for=False)

# Filter for specific routes (only non connected)
@freezer.register_generator
def fights_generator():
    for status in FightStatus:
        yield f'/fights/{status._value_}/count.json'
        with open(join(app.config["FREEZER_DESTINATION"], "fights", status._value_, "count.json")) as f:
            count = int(f.read())
        
        limit = 20
        for i in range(0, count, limit):
            page = (i // limit) + 1
            yield f'/fights/{status._value_}/{limit}/{page}/index.json'

        if status == FightStatus.DONE:
            for fight in Fight.query.all():
                yield f'/fights/json/{fight.id}/index.json'
            

@freezer.register_generator
def groups_generator():
    yield "/groups/agents_min_stats.json"
    yield "/groups/levd.json"
    yield "/groups/palmares.json"

if __name__ == '__main__':
    freezer.freeze()