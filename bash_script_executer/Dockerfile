ARG BUILD_FROM
FROM $BUILD_FROM
ENV LANG C.UTF-8

# Create directory for apache2 to store PID file
RUN mkdir /run/apache2

RUN apk update && apk upgrade
RUN apk --no-cache add busybox-extras curl grep coreutils sed xmlstarlet bash

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]
