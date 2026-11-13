#!/usr/bin/env python3
"""Example Abyss game launcher.

Abyss invokes this script as:
  python main.py -p PORT -f LOG -t local agent_1 agent_2
  python main.py -p PORT -f LOG -t verify agent_1
"""

import argparse


def main() -> None:
    # Match the standard Abyss CLI declared in game.json.
    parser = argparse.ArgumentParser()
    parser.add_argument("-p", "--port", type=int, required=True)
    parser.add_argument("-f", "--log", required=True)
    parser.add_argument("-t", "--type", choices=("local", "verify"),
                        required=True)
    parser.add_argument("players", nargs="+")
    args = parser.parse_args()

    # TODO: build the Seahorse GameMaster, import the player modules from
    # args.players, then call record_game() or record_dummy_game().
    raise NotImplementedError("Implement the Seahorse game launcher here")


if __name__ == "__main__":
    main()
