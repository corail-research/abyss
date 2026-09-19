#!/bin/bash
 
cd ${RUNDIR}
python -m venv venv
venv/bin/pip3 install --upgrade pip -q
venv/bin/pip3 install seahorse colorama numpy -q

P1=${PLAYER_1%.py}; P1=${P1##*/}

if [[ "$TYPE" == "arena" ]]; then
    if [ -f "requirements.txt" ]; then
        venv/bin/pip3 install --ignore-installed -r requirements.txt -q |& tee pip_${PLAYER_1}-${PLAYER_2}.log
        echo $? > code_pip_${P1}-${P2}.log
    fi
    P2=${PLAYER_2%.py}; P2=${P2##*/}
    # timeout 2000 venv/bin/python3 YOUR_MAIN.py -p ${PORT} -f ${P1}-${P2}.log -t local ${PLAYER_1} ${PLAYER_2}
    echo $? > timeout_${P1}-${P2}.log

else
    if [ -f "requirements.txt" ]; then
        venv/bin/pip3 install --ignore-installed -r requirements.txt -q |& tee pip_${PLAYER_1}.log
        echo $? > code_pip_${P1}.log
    fi
    # timeout 1000 venv/bin/python3 YOUR_MAIN.py -p ${PORT} -f ${P1}.log -t verify ${PLAYER_1}
    echo $? > timeout_${P1}.log
fi
