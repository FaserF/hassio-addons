ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:12.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

RUN \
apk add --no-cache \
    wget python3 python3-dev py3-pip lzo-dev mtd-utils-ubi squashfs-tools fakeroot make g++ coreutils

#Install Pip Dependencies
RUN pip install python-lzo
RUN pip install ubi_reader

RUN mkdir /xqrepack
WORKDIR /xqrepack

RUN wget -O /xqrepack/repack-squashfs.sh https://raw.githubusercontent.com/geekman/xqrepack/master/repack-squashfs.sh
RUN wget -O /xqrepack/ubinize.sh https://raw.githubusercontent.com/geekman/xqrepack/master/ubinize.sh
#RUN wget -O /xqrepack/xqflash https://raw.githubusercontent.com/geekman/xqrepack/master/xqflash

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]
