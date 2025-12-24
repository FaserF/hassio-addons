ARG BUILD_FROM
FROM ${BUILD_FROM}

RUN mkdir /application

# Install necessary packages
RUN apk add --no-cache tzdata bluez bluez-libs sudo bluez-deprecated
RUN apk add --no-cache --virtual build-dependencies git bluez-dev musl-dev make gcc glib-dev
RUN apk add --no-cache --update wget unzip py3-pip

# Download and unzip the application
RUN wget https://github.com/zewelor/bt-mqtt-gateway/archive/refs/heads/master.zip
RUN unzip -d /tmp/ master.zip && rm -r master.zip && cp -r /tmp/bt-mqtt-gateway-master/* /application

# Ensure gateway.py is executable
RUN chmod +x /application/gateway.py

# Manually create logger.yaml if it doesn't exist using heredoc
RUN cat <<EOF > /application/logger.yaml
version: 1
disable_existing_loggers: True

formatters:
  default:
    format: '%(asctime)s %(message)s'
    datefmt: '%X'
  minimal:
    format: '%(message)s'
  debug:
    format: '%(asctime)s %(levelname)s %(name)s %(filename)s:%(lineno)d:%(funcName)s - %(message)s'

handlers:
  console:
    class: logging.StreamHandler
    formatter: default
    stream: ext://sys.stdout
  dummy_debug:
    class: logging.NullHandler
    formatter: debug

loggers:
  bt-mqtt-gw:
    level: INFO
  dummy_debug:
    handlers: [dummy_debug]

root:
  handlers: [console]
EOF

# Prepare virtual environment
RUN python3 -m venv /application/venv

# Activate venv and install dependencies from requirements.txt
RUN /bin/sh -c "source /application/venv/bin/activate && pip install --no-cache-dir -r /application/requirements.txt"

# Debugging step: show the content of gateway.py
RUN cat /application/gateway.py

# Debugging step: directly run gateway.py to check for errors and log the output
RUN /bin/sh -c "source /application/venv/bin/activate && python /application/gateway.py -r all > /application/gateway_output.log 2>&1 || (cat /application/gateway_output.log && exit 1)"

# If the above step is successful, install the dependencies listed by gateway.py
RUN /bin/sh -c "source /application/venv/bin/activate && pip install --no-cache-dir $(/application/gateway.py -r all)"

# Clean up
RUN apk del build-dependencies wget unzip

# Copy start script and make it executable
COPY start.sh /
RUN chmod a+x /start.sh

CMD [ "/start.sh" ]
