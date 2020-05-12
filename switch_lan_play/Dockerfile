ARG BUILD_FROM
FROM $BUILD_FROM
ENV LANG C.UTF-8

# Install requirements for add-on
RUN apk -U --no-cache add libpcap-dev
RUN apk -U --no-cache add libuv-dev
RUN apk -U --no-cache add git
RUN apk -U --no-cache add g++
RUN apk -U --no-cache add cmake
RUN apk -U --no-cache add nano
RUN apk -U --no-cache add screen
RUN apk -U --no-cache add build-base
# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh

#COPY lan-play-tinkerboard /
#RUN chmod a+x /lan-play-tinkerboard

CMD [ "/run.sh" ]