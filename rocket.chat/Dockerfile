ARG BUILD_FROM=ghcr.io/hassio-addons/debian-base/amd64:4.2.0
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# hadolint ignore=DL3009
RUN \
    apt-get update \
    \
    && apt-get install -y --no-install-recommends \
        dirmngr gnupg
    && apt-get clean

RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
RUN echo "deb http://repo.mongodb.org/apt/debian stretch/mongodb-org/4.0 main" | tee /etc/apt/sources.list.d/mongodb-org-4.0.list
RUN apt -y update && apt install -y curl && curl -sL https://deb.nodesource.com/setup_12.x | bash -
RUN \
    apt-get update \
    \
    && apt-get install -y --no-install-recommends \
        build-essential mongodb-org nodejs fontconfig graphicsmagick
    && apt-get clean
RUN npm install -g inherits n && n 12.18.4
RUN curl -L https://releases.rocket.chat/latest/download -o /tmp/rocket.chat.tgz
RUN tar -xzf /tmp/rocket.chat.tgz -C /tmp
RUN cd /tmp/bundle/programs/server && npm install
RUN mv /tmp/bundle /opt/Rocket.Chat
RUN useradd -M rocketchat && usermod -L rocketchat
RUN chown -R rocketchat:rocketchat /opt/Rocket.Chat
RUN echo [Unit] >> /lib/systemd/system/rocketchat.service
RUN echo Description=The Rocket.Chat server >> /lib/systemd/system/rocketchat.service
RUN echo After=network.target remote-fs.target nss-lookup.target nginx.service mongod.service >> /lib/systemd/system/rocketchat.service
RUN echo [Service] >> /lib/systemd/system/rocketchat.service
RUN echo ExecStart=/usr/local/bin/node /opt/Rocket.Chat/main.js >> /lib/systemd/system/rocketchat.service
RUN echo StandardOutput=syslog >> /lib/systemd/system/rocketchat.service
RUN echo StandardError=syslog >> /lib/systemd/system/rocketchat.service
RUN echo SyslogIdentifier=rocketchat >> /lib/systemd/system/rocketchat.service
RUN echo User=rocketchat >> /lib/systemd/system/rocketchat.service
RUN echo Environment=MONGO_URL=mongodb://localhost:27017/rocketchat?replicaSet=rs01 
RUN echo MONGO_OPLOG_URL=mongodb://localhost:27017/local?replicaSet=rs01 
RUN echo ROOT_URL=http://localhost:3000/ PORT=3000 >> /lib/systemd/system/rocketchat.service
RUN echo [Install] >> /lib/systemd/system/rocketchat.service
RUN echo WantedBy=multi-user.target >> /lib/systemd/system/rocketchat.service

RUN sed -i "s/^#  engine:/  engine: wiredTiger/"  /etc/mongod.conf
RUN sed -i "s/^#replication:/replication:\n  replSetName: rs01/" /etc/mongod.conf
RUN systemctl enable mongod && systemctl start mongod
RUN systemctl enable mongod && systemctl start mongod
RUN mongo --eval "printjson(rs.initiate())"
RUN systemctl enable rocketchat && systemctl start rocketchat

# app runs on port 3000
EXPOSE 3000

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]