from enum import Enum, unique
from werkzeug.routing import BaseConverter, ValidationError

class CustomEnum(str, Enum):
    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            value = value.lower()
            for member in cls:
                if member.lower() == value:
                    return member
        return None

    @classmethod
    def has_value(cls, value):
        return value in cls._value2member_map_

@unique
class AgentStatus(CustomEnum):
    PENDING = 'pending'
    DELETED = 'deleted'
    INVALID = 'invalid'
    ACTIVE = 'active'
    INACTIVE = 'inactive'
    QUARANTINE = 'quarantine'

@unique
class FightStatus(CustomEnum):
    SCHEDULED = 'scheduled'
    DONE = 'done'
    IN_PROGRESS = 'in_progress'
    CANCELLED = 'cancelled'

@unique
class GroupStatus(CustomEnum):
    ACTIVE = 'active'
    INACTIVE = 'inactive'

@unique
class CustomStatAggregation(CustomEnum):
    SUM = 'sum'
    MEAN = 'mean'
    MIN = 'min'
    MAX = 'max'

class FightStatusConverter(BaseConverter):

    def to_python(self, value):
        try:
            fight_status = FightStatus(value)
            return fight_status
        except ValueError as _:
            raise ValidationError()

    def to_url(self, value):
        return value.value