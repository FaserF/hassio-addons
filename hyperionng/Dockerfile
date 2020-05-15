ARG BUILD_FROM
FROM $BUILD_FROM
ENV LANG C.UTF-8

# Install requirements for add-on
RUN apk -U --no-cache add wget
RUN apk -U --no-cache add qt5-qtbase-dev
RUN apk -U --no-cache add qt5-qtserialport
RUN apk -U --no-cache add libusb
RUN apk -U --no-cache add python3-dev
RUN apk -U --no-cache add libxrender-dev
RUN apk -U --no-cache add avahi-dev
RUN apk -U --no-cache add libjpeg-turbo
RUN apk -U --no-cache add qt5-qtbase-sqlite
RUN apk -U --no-cache add libressl-dev
RUN apk -U --no-cache add raspberrypi
RUN apk -U --no-cache add build-base
RUN apk -U --no-cache add libc6-compat
RUN apk -U --no-cache add libc-dev
RUN apk -U --no-cache add coreutils 
# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]