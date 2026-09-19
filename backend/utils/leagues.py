import math

import numpy as np

from sqlalchemy.orm import Session

from backend.models import Group, Agent
from backend.models.enums import GroupStatus, AgentStatus

def update_league_standings(db_session: Session, leagues: list):
    """
    Assigns leagues to groups based on their highest ELO.
    Updates `group.league_history` in place and commits.
    """
    # 1. Find active groups with at least one active/inactive agent
    valid_groups = db_session.query(Group).filter(
        Group.status == GroupStatus.ACTIVE,
        Group.agents.any(
            (Agent.status == AgentStatus.ACTIVE) |
            (Agent.status == AgentStatus.INACTIVE)
        )
    ).all()

    valid_group_ids = {g.id for g in valid_groups}

    # 2. Groups with no valid agents -> set league to "no_league"
    groups_no_league = db_session.query(Group).filter(
        Group.id.notin_(valid_group_ids)
    ).all()

    for group in groups_no_league:
        if group.league_history.get("current_league") != "no_league":
            group.league_history["previous_league"] = group.league_history["current_league"]
            group.league_history["current_league"] = "no_league"

    # 3. Compute max ELO per valid group (only ACTIVE/INACTIVE agents)
    groups_elo = []
    for group in valid_groups:
        max_elo = max(
            [agent.elo for agent in group.agents if agent.status in {AgentStatus.ACTIVE, AgentStatus.INACTIVE}],
            default=-math.inf
        )
        groups_elo.append(max_elo)

    # 4. Sort groups by highest ELO (ascending, so weakest first)
    sorted_groups = [g for _, g in sorted(zip(groups_elo, valid_groups),
                                          key=lambda x: x[0])]

    total_groups = len(sorted_groups)
    num_leagues = len(leagues)

    # 5. Distribute groups into leagues
    if total_groups < num_leagues:
        # Not enough groups for all leagues: assign strongest groups to top leagues
        for i, group in enumerate(sorted_groups):
            if group.league_history.get("current_league") != "no_league":
                group.league_history["previous_league"] = group.league_history["current_league"]
            league_name = leagues[i] if i < num_leagues else leagues[-1]
            group.league_history["current_league"] = league_name
            # Update best/worst counts if at extremes
            if league_name == leagues[-1]:
                group.league_history["best_league"] += 1
            if league_name == leagues[0]:
                group.league_history["worst_league"] += 1
    else:
        # Gaussian distribution over leagues
        weights = np.linspace(1, num_leagues, num_leagues)
        std_dev = num_leagues / 3
        weights = np.exp(-((weights - (num_leagues + 1) / 2) ** 2) / (2 * (std_dev ** 2)))
        weights /= weights.sum()

        groups_per_league = np.ceil(weights * total_groups).astype(int)

        # Ensure at least one group per league
        for i in range(num_leagues):
            if groups_per_league[i] == 0:
                groups_per_league[i] = 1

        # Adjust to match total_groups (remove excess from largest leagues first)
        sorted_league_indices = sorted(range(num_leagues), key=lambda i: groups_per_league[i], reverse=True)
        while groups_per_league.sum() > total_groups:
            for i in sorted_league_indices:
                if groups_per_league[i] > 1:
                    groups_per_league[i] -= 1
                    if groups_per_league.sum() == total_groups:
                        break

        league_index = 0
        for i, group in enumerate(sorted_groups):
            # Move to next league if current one is full
            while league_index < num_leagues and groups_per_league[league_index] <= 0:
                league_index += 1
                if league_index >= num_leagues:
                    break
            if league_index >= num_leagues:
                break

            # Update history
            if group.league_history.get("current_league") != "no_league":
                group.league_history["previous_league"] = group.league_history["current_league"]

            league_name = leagues[league_index]
            group.league_history["current_league"] = league_name
            if league_name == leagues[-1]:
                group.league_history["best_league"] += 1
            if league_name == leagues[0]:
                group.league_history["worst_league"] += 1

            groups_per_league[league_index] -= 1

    # 6. Commit all changes
    db_session.commit()
