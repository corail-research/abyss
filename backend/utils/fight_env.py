import shutil
import os
from pathlib import Path
import re
import json
import logging
import gzip


class BrokenMatch(Exception):
    def __init__(self, message="Error during a match",
                 agent_id=None, confidence=False):
        self.message = message
        self.agent_id = agent_id
        self.confidence = confidence
        super().__init__(self.message)


# TODO: rework with list of (agent, group) for game with more than 2 player
def create_env(rundir, group1, agent1, group2=None, agent2=None):
    # Specify the source and destination directories
    env_dir = f"./{rundir}"
    Path(env_dir).mkdir(parents=True, exist_ok=True)
    requirements = []

    source_dirs = [
            "../game", f'../student_agents/group_{group1}/agent_{agent1}/']
    if group2 is not None and agent2 is not None:
        source_dirs.append(
                f'../student_agents/group_{group2}/agent_{agent2}/')

    for source_directory in source_dirs:
        # Iterate through each item in the source directory
        contents = os.listdir(source_directory)
        for item in contents:
            if item == 'requirements.txt':
                with open(
                        os.path.join(source_directory, item),
                        'r', encoding="utf8") as f:
                    requirements += f.read().split('\n')

            source_path = os.path.join(source_directory, item)
            destination_path = os.path.join(env_dir, item)

            # Check if the item is a file or a directory
            if os.path.isfile(source_path):
                # Copy the file to the destination directory
                shutil.copy(source_path, destination_path)
            elif os.path.isdir(source_path):
                # Copy the entire directory to the destination directory
                if os.path.exists(destination_path):
                    shutil.rmtree(destination_path)
                shutil.copytree(source_path, destination_path)
    # remove the version numbers from the requirements
    requirements = list(set([r.split("@")[0] for r in requirements if r]))
    requirements = list(set([r.split("==")[0] for r in requirements if r]))
    if 'pympler' in requirements:
        requirements.remove('pympler')
    if 'colorama' in requirements:
        requirements.remove('colorama')
    if 'seahorse' in requirements:
        requirements.remove('seahorse')
    if 'json' in requirements:
        requirements.remove('json')

    with open(os.path.join(env_dir, 'requirements.txt'), 'w') as f:
        f.write('\n'.join(list(set(requirements))).strip())


def post_play_env(rundir, verify=False):
    env_dir = f"./{rundir}"
    pattern_rec = r"^__REC__([0-9]+)\.json$"
    pattern_log = r"^([a-zA-Z0-9_\-]+)\.log$"

    for file in os.listdir(env_dir):
        if (not os.path.isfile(f"{env_dir}/{file}")
                or (not (re.match(pattern_rec, file) and not verify)
                    and not re.match(pattern_log, file)
                    and file != "entrypoint.sh")):
            if os.path.isdir(f"{env_dir}/{file}"):
                shutil.rmtree(f"{env_dir}/{file}")
            else:
                os.remove(f"{env_dir}/{file}")


def compress_play_env_files(rundir):
    env_dir = Path(f"./{rundir}")

    for file in env_dir.iterdir():
        if file.is_file() and file.suffix != ".gz":
            output = file.with_suffix(file.suffix + ".gz")

            with file.open("rb") as fin:
                with gzip.open(output, "wb") as fout:
                    shutil.copyfileobj(fin, fout)

            file.unlink()


def get_record(rundir, agent1, agent2, logger: logging.Logger) -> list[dict]:
    env_dir = f"./{rundir}"
    pattern_rec = r"^__REC__([0-9]+)\.json$"
    pattern_log_line = r"^([0-9a-zA-Z\- \.:|_]+) Player now playing : "
    error_line = ""

    ended_with_error = False
    message = "The agent is probably using too much memory, or the record is incomplete."
    confidence = False
    for file in os.listdir(env_dir):
        if re.match(pattern_rec, file):
            with open(env_dir + "/" + file) as f:
                data = json.load(f)
                if (data.get("final_summary") is None
                        or data.get("final_summary").get("status") == "cancelled"):
                    logger.error("Error with " + str(rundir))
                    ended_with_error = True
                else:
                    return data
    else:
        ended_with_error = True

    if ended_with_error:
        with open(env_dir + f"/agent_{agent1}-agent_{agent2}.log") as f:
            for line in f.readlines():
                if re.match(pattern_log_line, line):
                    m = re.search(r"agent_([0-9]+)", line)
                    keep_line = m.group()
                if "Error:" in line:
                    print("ERROR Line : ", line)
                    error_line = line

                if "ERROR" in line:
                    print("ERROR LINE : ", line)
                    tmp = line.split(' - ')[-1].split("for player")[0]
                    if tmp != "":
                        error_line = tmp

        index = keep_line.find("_")
        if error_line != "":
            message = "The agent caused the following error: "+error_line
            confidence = True
        elif os.path.exists(env_dir + f"/timeout_agent_{agent1}-agent_{agent2}.log"):
            with open(env_dir + f"/timeout_agent_{agent1}-agent_{agent2}.log") as f:
                code = int(f.read())
                if code >= 124:  # error code from timeout command
                    message = "The agent used up its own time credit and the match's time credit"
                    confidence = True

        id_error = int(keep_line[index+1:])
        raise BrokenMatch(
                message=message, agent_id=int(id_error), confidence=confidence)


def get_error_verify_log(rundir, agent1) -> tuple[bool, str]:
    env_dir = f"./{rundir}"
    pattern_error_pip_line = r"ERROR: .*[\r\n]+"
    pattern_error_line = r"^([0-9\- \.:|]+) ERROR ([ ]+)\| "

    message = None
    if os.path.exists(env_dir + f"/pip_agent_{agent1}.log"):
        with open(env_dir + f"/code_pip_agent_{agent1}.log") as f:
            code = int(f.read())
            if code > 0:
                message = ("Your requirements are incompatible "
                           "with the required Python version or with Linux")
        if code == 0:
            with open(env_dir + f"/pip_agent_{agent1}.log") as f:
                text = f.read()
                matchs = re.findall(pattern_error_pip_line, text)
                if len(matchs) > 0:
                    message = matchs[-1]
    if message is not None:
        return True, message
    with open(env_dir + f"/agent_{agent1}.log") as f:
        for line in f.readlines():
            print(line)
            if re.match(pattern_error_line, line):
                message = re.sub(pattern_error_line, "", line)
                break

    if message is not None:
        return True, message

    if os.path.exists(env_dir + f"/timeout_agent_{agent1}.log"):
        with open(env_dir + f"/timeout_agent_{agent1}.log") as f:
            code = int(f.read())
            if code >= 124:
                message = ("The agent used up its own time credit "
                           "and the match's time credit")

    if message is not None:
        return True, message

    return False, ""


def change_agent_name_in_json(run_dir, player1_name, player2_name):
    env_dir = f"./{run_dir}"
    pattern_rec = r"^__REC__([0-9]+)\.json$"
    fname = None
    for file in os.listdir(env_dir):
        if re.match(pattern_rec, file):
            fname = file
            with open(env_dir + "/" + file) as f:
                data = json.load(f)
                player1_id = data["final_summary"]["players"][0]["id"]
                is_player_1 = True
                print(player1_id)
                for step in data["steps"]:
                    if isinstance(step["active_player"], dict):
                        step["active_player"]["name"] = player1_name \
                                                        if is_player_1 \
                                                        else player2_name
                    if isinstance(step["players"][0], dict):
                        step["players"][0]["name"] = player1_name
                    if isinstance(step["players"][1], dict):
                        step["players"][1]["name"] = player2_name
                    is_player_1 = not is_player_1

    if fname:
        with open(env_dir + "/" + fname, 'w') as f:
            f.write(json.dumps(data))
