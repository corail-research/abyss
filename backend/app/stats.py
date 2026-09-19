from flask import current_app

from sqlalchemy import func, case, select, column, Integer, String

from backend.db import db

from backend.models import (
        Group, Fight, Agent, AgentStatus, FightStatus, CustomStats)
from backend.app.utils import log_and_return

# Different aggregation cases
AGG_CASES = [(CustomStats.aggregation == 'sum', func.sum(CustomStats.value)),
             (CustomStats.aggregation == 'mean', func.avg(CustomStats.value)),
             (CustomStats.aggregation == 'max', func.max(CustomStats.value)),
             (CustomStats.aggregation == 'min', func.min(CustomStats.value))]


def get_groups_min_stats():
    n_victories_per_agents = select(Agent.id, func.coalesce(func.count(Fight.id), 0).label("n_victories"))\
        .outerjoin(Fight, (Fight.winner_id == Agent.id) & (Fight.status == FightStatus.DONE))\
        .group_by(Agent.id).subquery()
    
    n_defeats_per_agents = select(Agent.id, func.coalesce(func.count(Fight.id), 0).label("n_defeats"))\
        .outerjoin(Fight, ((Fight.player1_id == Agent.id) | (Fight.player2_id == Agent.id)) 
                            & (Fight.winner_id != Agent.id) 
                            & (Fight.status == FightStatus.DONE))\
        .group_by(Agent.id).subquery()
    
    n_scored_conceeded = select(Agent.id, 
                func.coalesce(func.sum(case((Fight.player1_id == Agent.id, Fight.score_player1), else_=Fight.score_player2)),0).label("n_points_scored"),
                func.coalesce(func.sum(case((Fight.player1_id == Agent.id, Fight.score_player2), else_=Fight.score_player1)),0).label("n_points_conceded"))\
        .outerjoin(Fight, ((Fight.player1_id == Agent.id) | (Fight.player2_id == Agent.id)) & (Fight.status == FightStatus.DONE))\
        .group_by(Agent.id).subquery()
    
    agents_stats = select(Agent.id, Agent.name, Agent.elo, Agent.group_id,
                          column("n_victories").label("n_v"),
                          column("n_defeats").label("n_d"),
                          column("n_points_scored").label("n_s"),
                          column("n_points_conceded").label("n_c"))\
                .join(n_victories_per_agents, n_victories_per_agents.c.id == Agent.id)\
                .join(n_defeats_per_agents, n_defeats_per_agents.c.id == Agent.id)\
                .join(n_scored_conceeded, n_scored_conceeded.c.id == Agent.id).subquery()
    
    groups_min_stats = select(Group.id, Group.name,
                              func.array_agg(
                                    func.jsonb_build_object(
                                        "id", agents_stats.c.id,
                                        "name", agents_stats.c.name,
                                        "n_victories", column("n_v"),
                                        "n_defeats", column("n_d"),
                                        "n_points_scored", column("n_s"),
                                        "n_points_conceded", column("n_c"),
                                    )
                                ).label("agents"))\
        .join(agents_stats, agents_stats.c.group_id == Group.id)\
        .group_by(Group.id)\
        .order_by(Group.id)
    
    results = db.session.execute(groups_min_stats).mappings().all()

    return results

def get_groups_levd():
    agent_types = [AgentStatus.ACTIVE, AgentStatus.INACTIVE]
    
    n_victories_per_agents = select(Agent.id, 
                                    func.coalesce(func.count(Fight.id), 0).label("n_victories_agents"))\
        .outerjoin(Fight, (Fight.winner_id == Agent.id) & (Fight.status == FightStatus.DONE))\
        .where(Agent.status.in_(agent_types))\
        .group_by(Agent.id).subquery()
    
    n_defeats_per_agents = select(Agent.id, 
                                  func.coalesce(func.count(Fight.id), 0).label("n_defeats_agents"))\
        .outerjoin(Fight, ((Fight.player1_id == Agent.id) | (Fight.player2_id == Agent.id)) 
                            & (Fight.winner_id != Agent.id) 
                            & (Fight.status == FightStatus.DONE))\
        .where(Agent.status.in_(agent_types))\
        .group_by(Agent.id).subquery()
    
    agents_stats = select(Agent.id, Agent.name, 
                          Agent.status, Agent.elo, Agent.group_id,
                          column("n_victories_agents").label("n_v"),
                          column("n_defeats_agents").label("n_d"))\
                .join(n_victories_per_agents, n_victories_per_agents.c.id == Agent.id)\
                .join(n_defeats_per_agents, n_defeats_per_agents.c.id == Agent.id)
    
    group_stats = select(Group.id, Group.name, 
                        Group.league_history["current_league"].label("league"),
                        Group.league_history["previous_league"].label("previous_league"),
                        func.sum(column("n_v")).label("n_victories"),
                        func.sum(column("n_d")).label("n_defeats"),
                        func.coalesce(func.max(agents_stats.c.elo), 0).label("elo"),
                        func.array_agg(
                            func.jsonb_build_object(
                                "name", agents_stats.c.name,
                                "status", func.lower(func.cast(agents_stats.c.status, String)),
                                "elo", agents_stats.c.elo,
                                "n_victories", column("n_v"),
                                "n_defeats", column("n_d")
                            )
                        ).label("agents"))\
                .select_from(agents_stats)\
                .join(Group, agents_stats.c.group_id == Group.id)\
                .group_by(Group.id)

    return db.session.execute(group_stats).mappings().all()


def get_groups_palmares():
    agent_types = [AgentStatus.ACTIVE, AgentStatus.INACTIVE]

    # Win count by agents
    n_victories_per_agents = select(column("v_group_id"), func.sum(column("n_victories_agents")).label("n_victories"))\
        .select_from(
            select(Agent.id.label("a_v_id"), 
                                    Agent.group_id.label("v_group_id"),
                                    func.coalesce(func.count(Fight.id), 0).label("n_victories_agents"))\
            .outerjoin(Fight, (Fight.winner_id == Agent.id) & (Fight.status == FightStatus.DONE))\
            .where(Agent.status.in_(agent_types))\
            .group_by(Agent.id)
        ).group_by(column("v_group_id")).subquery()

    # Loose count by agents
    n_defeats_per_agents = select(column("d_group_id"), func.sum(column("n_defeats_agents")).label("n_defeats"))\
        .select_from(
        select(Agent.id.label("a_d_id"), 
                                  Agent.group_id.label("d_group_id"),
                                  func.coalesce(func.count(Fight.id), 0).label("n_defeats_agents"))\
        .outerjoin(Fight, ((Fight.player1_id == Agent.id) | (Fight.player2_id == Agent.id)) 
                            & (Fight.winner_id != Agent.id) 
                            & (Fight.status == FightStatus.DONE))\
        .where(Agent.status.in_(agent_types))\
        .group_by(Agent.id)
    ).group_by(column("d_group_id")).subquery()

    # Subquery to select all group fights and if they win (1) or not (0)
    group_fights_win = select(Group.id.label("g_id"), Fight.id.label("f_id"), 
                               func.cast(Fight.winner_id == Agent.id, Integer).label("winner"))\
        .outerjoin(Agent, ((Fight.player1_id == Agent.id) | (Fight.player2_id == Agent.id))
                            & (Agent.status.in_(agent_types)))\
        .join(Group, Agent.group_id == Group.id)\
        .where(Fight.status == FightStatus.DONE)\
        .group_by(Group.id, Agent.id, Fight.id).order_by(Group.id, Fight.id).subquery()
    


    # Create groupements of successive win and loose and calculate the largest streaks
    islands = select(column("g_id"), column("winner"), func.max(column("cnt")).label("max_cnt")).select_from(
                select(column("g_id"), column("winner"), func.count().label("cnt")).select_from(
                    select(column("g_id"), column("winner"),
                    func.row_number().over(order_by=(column("g_id"), column("f_id"))).label("seqnum"),
                    func.row_number().over(order_by=(column("g_id"),column("f_id")), partition_by=column("winner")).label("seqnum_p"))\
                    .select_from(group_fights_win).subquery()
                ).group_by(column("g_id"), column("winner"), (column("seqnum") - column("seqnum_p"))).subquery()
            ).group_by(column("g_id"), column("winner")).order_by(column("g_id")).subquery()
    
    n_scored_conceeded = select(column("sc_group_id"),
                                func.sum(column("n_scored_agents")).label("n_points_scored"),
                                func.sum(column("n_conceded_agents")).label("n_points_conceded"))\
        .select_from(
        select(Agent.id.label("a_sc_id"), 
               Agent.group_id.label("sc_group_id"), 
                func.coalesce(func.sum(case((Fight.player1_id == Agent.id, Fight.score_player1), else_=Fight.score_player2)),0).label("n_scored_agents"),
                func.coalesce(func.sum(case((Fight.player1_id == Agent.id, Fight.score_player2), else_=Fight.score_player1)),0).label("n_conceded_agents"))\
        .outerjoin(Fight, ((Fight.player1_id == Agent.id) | (Fight.player2_id == Agent.id)) & (Fight.status == FightStatus.DONE))\
        .where(Agent.status.in_(agent_types))\
        .group_by(column("a_sc_id"))\
        .order_by(column("a_sc_id")).subquery()
    ).group_by(column("sc_group_id")).subquery()
    
    # Get distincts custom_stats and their aggregate
    custom_stats = (
        select(Group.id.label("g_cs_id"), CustomStats.name.label("cs_name"), func.cast(case(*AGG_CASES).label("cs_value"), Integer))\
        .join(Agent, Agent.group_id == Group.id)\
        .join(CustomStats, CustomStats.agent_id == Agent.id)\
        .where(Agent.status.in_(agent_types))\
        .group_by(Group.id, CustomStats.name, CustomStats.aggregation)\
        .order_by(Group.id).subquery()
    )

    group_stats = select(Group.id, Group.name,
                        Group.league_history["best_league"].label("n_days_in_best_league"),
                        Group.league_history["worst_league"].label("n_days_in_worst_league"),
                        func.max(case((column("winner")==0, column("max_cnt")))).label("largest_loosing_streak"),
                        func.max(case((column("winner")==1, column("max_cnt")))).label("largest_win_streak"),
                        column("n_victories"),
                        column("n_defeats"),
                        column("n_points_scored"),
                        column("n_points_conceded"),
                        func.jsonb_object_agg(
                            column("cs_name"),
                            column("cs_value")
                        ).label("custom_stats"),
                        func.coalesce(func.max(Agent.elo), 0).label("elo"))\
                .join(Agent, Agent.group_id == Group.id)\
                .join(n_victories_per_agents, n_victories_per_agents.c.v_group_id == Group.id)\
                .join(n_defeats_per_agents, n_defeats_per_agents.c.d_group_id == Group.id)\
                .join(n_scored_conceeded, n_scored_conceeded.c.sc_group_id == Group.id)\
                .join(islands, islands.c.g_id == Group.id)\
                .join(custom_stats, custom_stats.c.g_cs_id == Group.id)\
                .group_by(
                    Group.id, column("n_victories"), column("n_defeats"),
                    column("n_points_scored"),column("n_points_conceded"))

    return db.session.execute(group_stats).all()


# OLDER ROUTE
# TODO: Allow version for all groups or subset of groups
# 
def get_stats(group_id: int) -> dict:
    try:
        agent_types = [AgentStatus.ACTIVE, AgentStatus.INACTIVE]
        group = db.session.query(Group).filter_by(id=group_id).first()
        if group:
            
            # TODO: change it when leagues have their own table
            stats = {}

            # Subquery to select valid agents ID
            agents_group = select(Agent).filter(
                (Agent.group_id == group_id) & (Agent.status.in_(agent_types))
            ).with_only_columns(Agent.id)

            # Retrieve maximum elo and peak elo from agents
            elo_and_peak = db.session.execute(
                select(func.coalesce(func.max(Agent.elo), 0), 
                       func.coalesce(func.max(Agent.peak_elo),0)).where(Agent.id.in_(agents_group))
            ).first()
            
            stats['elo'] = elo_and_peak[0]
            stats['peak_elo'] = elo_and_peak[1]

            # Retrieve all agents victories
            n_victories_per_agents = db.session.execute(
                select(Agent.id, func.coalesce(func.count(Fight.id), 0))\
                .outerjoin(Fight, (Fight.winner_id == Agent.id) & (Fight.status == FightStatus.DONE))\
                .where(Agent.id.in_(agents_group))\
                .group_by(Agent.id)
            ).all()
            if n_victories_per_agents:
                stats['n_victories'] = sum([x[1] for x in n_victories_per_agents])
                stats['n_victories_per_agent'] = {k:v for k,v in n_victories_per_agents}
            else:
                stats['n_victories_per_agent'] = {}
                stats['n_victories'] = 0
            
            # Retrieve all agents defeats            
            n_defeats_per_agents = db.session.execute(
                select(Agent.id, func.coalesce(func.count(Fight.id), 0))\
                .outerjoin(Fight, ((Fight.player1_id == Agent.id) | (Fight.player2_id == Agent.id)) 
                                & (Fight.winner_id != Agent.id) 
                                & (Fight.status == FightStatus.DONE))\
                .where(Agent.id.in_(agents_group))\
                .group_by(Agent.id)
            ).all()
            if n_defeats_per_agents:
                stats['n_defeats'] = sum([x[1] for x in n_defeats_per_agents])
                stats['n_defeats_per_agent'] = {k:v for k,v in n_defeats_per_agents}
            else:
                stats['n_defeats_per_agent'] = {}
                stats['n_defeats'] = 0

            # Retrieve number of point scored and conceeded by agents
            n_scored_conceeded = db.session.execute(
                select(Agent.id, 
                       func.coalesce(func.sum(case((Fight.player1_id == Agent.id, Fight.score_player1), else_=Fight.score_player2)),0),
                       func.coalesce(func.sum(case((Fight.player1_id == Agent.id, Fight.score_player2), else_=Fight.score_player1)),0))\
                .outerjoin(Fight, ((Fight.player1_id == Agent.id) | (Fight.player2_id == Agent.id)) & (Fight.status == FightStatus.DONE))\
                .where(Agent.id.in_(agents_group))\
                .group_by(Agent.id)\
                .order_by(Agent.id)
            ).all()
            if n_scored_conceeded:
                stats['n_points_scored'] = sum([x[1] for x in n_scored_conceeded])
                stats['n_points_conceded'] = sum([x[2] for x in n_scored_conceeded])
                stats['n_points_scored_per_agent'] = {x[0]: x[1] for x in n_scored_conceeded} # tuple with id,scored 
                stats['n_points_conceded_per_agent'] = {x[0]: x[2] for x in n_scored_conceeded} # tuple with id,conceded 
            else:
                stats['n_points_scored_per_agent'] = {}
                stats['n_points_conceded_per_agent'] = {}
                stats['n_points_scored'] = 0
                stats['n_points_conceded'] = 0



            # Subquery to select all agents fights and if they win (1) or not (0)
            agents_fights = select(Fight.id.label("f_id"), func.cast(Fight.winner_id.in_(agents_group), Integer).label("winner"))\
                .where((Fight.player1_id.in_(agents_group)) | (Fight.player2_id.in_(agents_group)))\
                .where(Fight.status == FightStatus.DONE)\
                .group_by(Fight.id).order_by(Fight.id).subquery()

            # Create groupements of successive win and loose and calculate the largest streaks
            islands = select(column("winner"), func.max(column("cnt"))).select_from(
                select(column("winner"), func.count().label("cnt")).select_from(
                    select(column("f_id"), column("winner"),
                           func.row_number().over(order_by=column("f_id")).label("seqnum"),
                           func.row_number().over(order_by=column("f_id"), partition_by=column("winner")).label("seqnum_p"))\
                            .select_from(agents_fights).subquery()
                ).group_by(column("winner"), (column("seqnum") - column("seqnum_p"))).subquery()
            ).group_by(column("winner")).order_by(column("winner").desc())

            largest_win_loose_streak = db.session.execute(islands).all()
            if largest_win_loose_streak and len(largest_win_loose_streak) == 2:
                stats['largest_win_streak'] = largest_win_loose_streak[0][1]
                stats['largest_loosing_streak'] = largest_win_loose_streak[1][1]
            elif largest_win_loose_streak:
                if largest_win_loose_streak[0][0] == 0:
                    stats['largest_win_streak'] = 0
                    stats['largest_loosing_streak'] = largest_win_loose_streak[0][1]
                else:
                    stats['largest_win_streak'] = largest_win_loose_streak[0][1]
                    stats['largest_loosing_streak'] = 0

            else:
                stats['largest_win_streak'] = 0
                stats['largest_loosing_streak'] = 0
            
            # Get distincts custom_stats and their aggregate
            custom_stats = db.session.execute(
                select(CustomStats.name, func.cast(case(*AGG_CASES), Integer))\
                .where(CustomStats.agent_id.in_(agents_group))\
                .group_by(CustomStats.name, CustomStats.aggregation)
            ).all()

            if custom_stats:
                stats['custom_stats'] = {k:v for k,v in custom_stats}
            else:
                stats['custom_stats'] = {}

        return stats
        
    except Exception as e:
        return log_and_return(current_app.logger, f'Unexpected Error: {str(e)}', 'error', 500)

def get_stats_uncounted(group_id):
    try:
        agent_types = [AgentStatus.INVALID, AgentStatus.DELETED]    
        group = db.session.query(Group).filter_by(id=group_id).first()
        if group:
            
            stats = {}

            # Subquery to select valid agents ID
            agents_group = select(Agent).filter(
                (Agent.group_id == group_id) & (Agent.status.in_(agent_types))
            ).with_only_columns(Agent.id)

            # Retrieve all agents victories
            n_victories_per_agents = db.session.execute(
                select(Agent.id, func.coalesce(func.count(Fight.id), 0))\
                .outerjoin(Fight, (Fight.winner_id == Agent.id) & (Fight.status == FightStatus.DONE))\
                .where(Agent.id.in_(agents_group))\
                .group_by(Agent.id)
            ).all()
            if n_victories_per_agents:
                stats['n_victories_per_agent'] = {k:v for k,v in n_victories_per_agents}
            else:
                stats['n_victories_per_agent'] = {}
            
            # Retrieve all agents defeats            
            n_defeats_per_agents = db.session.execute(
                select(Agent.id, func.coalesce(func.count(Fight.id), 0))\
                .outerjoin(Fight, ((Fight.player1_id == Agent.id) | (Fight.player2_id == Agent.id)) 
                                & (Fight.winner_id != Agent.id) 
                                & (Fight.status == FightStatus.DONE))\
                .where(Agent.id.in_(agents_group))\
                .group_by(Agent.id)
            ).all()
            if n_defeats_per_agents:
                stats['n_defeats_per_agent'] = {k:v for k,v in n_defeats_per_agents}
            else:
                stats['n_defeats_per_agent'] = {}

            # Retrieve number of point scored and conceeded by agents
            n_scored_conceeded = db.session.execute(
                select(Agent.id, 
                       func.coalesce(func.sum(case((Fight.player1_id == Agent.id, Fight.score_player1), else_=Fight.score_player2)),0),
                       func.coalesce(func.sum(case((Fight.player1_id == Agent.id, Fight.score_player2), else_=Fight.score_player1)),0))\
                .outerjoin(Fight, ((Fight.player1_id == Agent.id) | (Fight.player2_id == Agent.id)) & (Fight.status == FightStatus.DONE))\
                .where(Agent.id.in_(agents_group))\
                .group_by(Agent.id)\
                .order_by(Agent.id)
            ).all()
            if n_scored_conceeded:
                stats['n_points_scored_per_agent'] = {x[0]: x[1] for x in n_scored_conceeded} # tuple with id,scored 
                stats['n_points_conceded_per_agent'] = {x[0]: x[2] for x in n_scored_conceeded} # tuple with id,conceded 
            else:
                stats['n_points_scored_per_agent'] = {}
                stats['n_points_conceded_per_agent'] = {}

        return stats
        
    except Exception as e:
        return log_and_return(current_app.logger, f'Unexpected Error: {str(e)}', 'error', 500)
