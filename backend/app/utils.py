import zipfile
import os
import pathlib
import subprocess
import magic

from backend.db import db

from backend.models.enums import AgentStatus


# Helper method for logging and responses
def log_and_return(logger, message, level='info', status_code=400):
    log_method = getattr(logger, level, 'info')
    log_method(message)
    return message, status_code

def is_right_extension(file_name, extension):
    return file_name.endswith(extension)

def is_file_binary(file_path: str) -> bool:
    try:
        with open(file_path, 'r') as fp:
            fp.read()
            return False
    except UnicodeDecodeError:
            return True

def read_mime_type(file):
    mime = magic.from_buffer(file.read(2048), mime=True)
    file.seek(0)
    return mime

def allowed_mime_type(file, allowed_mime):
    return read_mime_type(file) in allowed_mime

def process_zip_file(file, output_dir, agent_name, logger):
    try:
        if zipfile.is_zipfile(file):
            with zipfile.ZipFile(file) as zip_ref:
                zip_ref.extractall(output_dir)

            root_files = set(os.listdir(output_dir)).difference(["my_player.py", "requirements.txt"])
            for file in root_files:
                entry_output_path = os.path.join(output_dir, file)
                if not os.path.isdir(entry_output_path):
                    raise Exception(f"{file} should not be at root")

            myplayer_here = False
            root_folder = pathlib.Path(output_dir)
            for entry_name in root_folder.rglob("*"):
                entry_output_path = os.path.join(output_dir, entry_name)

                ## Convert dos files to unix format
                if entry_name.is_file():
                    if os.path.basename(entry_name) != "my_player.py":
                        try:
                            subprocess.check_output(['dos2unix', "-n", entry_output_path, entry_output_path + "_" ])
                            os.rename(entry_output_path + "_", entry_output_path)
                        except Exception as _:
                            logger.info(f"{entry_name} is not convertible (must be binary)")
                    else:
                        myplayer_here = True
                        subprocess.check_output(['dos2unix', "-n", entry_output_path, os.path.join(output_dir, agent_name + ".py")])
                        os.remove(entry_output_path)

            if myplayer_here:
                logger.info(f"Zipped agent processed at: {output_dir}")
            return True
        else:
            raise Exception(f"{file} is not a zip file")

    except Exception as error:
        logger.error(f'Error processing zip file: {error}')

    return False

def quarantine_agent(agent, reason="Agent placed in quarantine"):
    """
    Quarantine an agent by changing its status and setting a refusal message.
    
    Args:
        agent: The Agent object to quarantine
        reason: The reason for the quarantine
    """
    if agent:
        agent.status = AgentStatus.QUARANTINE
        agent.refusal_message = reason
        db.session.commit()
        return True
    return False

def quarantine_agents_by_ids(agent_ids, reason="Agents placed in quarantine due to match error"):
    """
    Quarantine multiple agents by their IDs.

    Args:
        agent_ids: List of agent IDs to quarantine
        reason: The reason for the quarantine
    Returns:
        List of quarantined agents
    """
    from .models import Agent # Importing here to avoid circular import issues
    
    quarantined_agents = []
    for agent_id in agent_ids:
        agent = Agent.query.get(agent_id)
        if agent and quarantine_agent(agent, reason):
            quarantined_agents.append(agent)
    
    return quarantined_agents
