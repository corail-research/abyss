from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.models import Agent, Group, Fight
from backend.models.enums import GroupStatus, AgentStatus, FightStatus


def calculate_elo_update(winner_elo: float, loser_elo: float,
                         k: int = 40, scaling: int = 250):
    """
    Compute new ELO ratings for winner and loser using classic MMR formula.
    Returns (new_winner_elo, new_loser_elo).
    """
    expected_winner = 1 / (1 + 10 ** ((loser_elo - winner_elo) / scaling))
    expected_loser = 1 - expected_winner
    new_winner_elo = int(winner_elo + k * (1 - expected_winner))
    new_loser_elo = int(loser_elo + k * (0 - expected_loser))
    return new_winner_elo, new_loser_elo


def get_recent_fights_per_agent(db_session: Session, agent_ids: list[int],
                                limit: int = 5):
    """
    Returns a list of (agent_id, opponent_id)
    for the most recent `limit` fights
    for each agent in `agent_ids`.
    """
    # Subquery for fights where agent is player1
    p1 = db_session.query(
        Fight.player1_id.label('agent_id'),
        Fight.player2_id.label('opponent_id'),
        Fight.id.label('fight_id'),
        Fight.date.label('fight_date')
    ).filter(
        Fight.player1_id.in_(agent_ids),
        Fight.status == FightStatus.DONE
    )

    # Subquery for fights where agent is player2
    p2 = db_session.query(
        Fight.player2_id.label('agent_id'),
        Fight.player1_id.label('opponent_id'),
        Fight.id.label('fight_id'),
        Fight.date.label('fight_date')
    ).filter(
        Fight.player2_id.in_(agent_ids),
        Fight.status == FightStatus.DONE
    )

    # Union the two sets
    union_query = p1.union(p2).subquery()

    # Apply row_number per agent, ordered by fight_date descending
    ranked = db_session.query(
        union_query.c.agent_id,
        union_query.c.opponent_id,
        func.row_number().over(
            partition_by=union_query.c.agent_id,
            order_by=desc(union_query.c.fight_date)
        ).label('rn')
    ).subquery()

    # Keep only the first `limit` rows per agent
    recent = db_session.query(
        ranked.c.agent_id,
        ranked.c.opponent_id
    ).filter(ranked.c.rn <= limit).all()

    return recent


def compute_matches(db_session: Session, scaling_factor=250,
                    recent_penalty=0.5, limit=5):
    # 1. Get active agents (only needed columns)
    agents = db_session.query(
        Agent.id,
        Agent.elo,
        Agent.name,
        Agent.group_id
    ).join(Group).filter(
        Group.status == GroupStatus.ACTIVE,
        Agent.status == AgentStatus.ACTIVE,
        Agent.elo.isnot(None)
    ).all()

    if len(agents) < 2:
        return []

    agent_ids = [a.id for a in agents]
    agent_map = {a.id: a for a in agents}

    # 2. Get recent fights per agent in ONE query
    recent_fights = get_recent_fights_per_agent(db_session, agent_ids, limit)

    # 3. Build recent_opponents set per agent
    recent_opponents = defaultdict(set)
    for agent_id, opponent_id in recent_fights:
        recent_opponents[agent_id].add(opponent_id)

    # 4. Build candidate pairs (ELO probability + recent penalty)
    candidate_pairs = []
    for i, a1 in enumerate(agents):
        for a2 in agents[i+1:]:
            if a1.group_id == a2.group_id:
                continue
            elo_diff = abs(a1.elo - a2.elo)
            prob = 1 / (1 + 10 ** (elo_diff / scaling_factor))
            if a2.id in recent_opponents.get(a1.id, set()):
                prob *= recent_penalty
            if a1.id in recent_opponents.get(a2.id, set()):
                prob *= recent_penalty
            candidate_pairs.append((a1.id, a2.id, prob))

    # 5. Greedy selection (sort by probability descending)
    candidate_pairs.sort(key=lambda x: x[2], reverse=True)
    used = set()
    selected = []
    for a1_id, a2_id, _ in candidate_pairs:
        if a1_id not in used and a2_id not in used:
            a1 = agent_map[a1_id]
            a2 = agent_map[a2_id]
            selected.append((
                {"id": a1.id, "elo": a1.elo,
                 "name": a1.name,
                 "group_id": a1.group_id},
                {"id": a2.id, "elo": a2.elo,
                 "name": a2.name,
                 "group_id": a2.group_id}
            ))
            used.add(a1_id)
            used.add(a2_id)
        if len(selected) == len(agents) // 2:
            break

    return selected
