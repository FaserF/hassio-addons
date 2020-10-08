FROM zewelor/bt-mqtt-gateway:latest

ENV LANG C.UTF-8

COPY ./start.sh /start.sh
RUN chmod +x /start.sh

ENTRYPOINT ["/bin/sh", "-c", "/start.sh"]
