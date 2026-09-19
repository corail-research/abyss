FROM python:3.13

RUN apt-get update && apt-get install -y iputils-ping

ENV MAIN="."
ENV MODE=""
ENV PLAYER_1=""
ENV PLAYER_2=""
ENV RUNDIR="."
ENV PORT="16001"
ENV TYPE="arena"

CMD ["bash", "entrypoint.sh"]
