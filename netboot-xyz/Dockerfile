ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:12.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

RUN \
 echo "**** install build packages ****" && \
 mkdir /app && \
 apk add --no-cache --virtual=build-dependencies \
	nodejs-npm && \
 echo "**** install runtime packages ****" && \
 apk add --no-cache \
	curl \
	dnsmasq \
	jq \
	nginx \
	nodejs \
	tftp-hpa && \
 echo "**** install WebApp ****" && \
 if [ -z ${WEBAPP_VERSION+x} ]; then \
	WEBAPP_VERSION=$(curl -sX GET "https://api.github.com/repos/netbootxyz/webapp/releases/latest" \
	| awk '/tag_name/{print $4;exit}' FS='[""]'); \
 fi && \
 curl -o \
 /tmp/webapp.tar.gz -L \
	"https://github.com/netbootxyz/webapp/archive/${WEBAPP_VERSION}.tar.gz" && \
 tar xf \
 /tmp/webapp.tar.gz -C \
	/app/ --strip-components=1 && \
 npm config set unsafe-perm true && \
 npm install --prefix /app && \
 echo "**** cleanup ****" && \
 apk del --purge \
	build-dependencies && \
 rm -rf \
	/tmp/*

# copy local files
COPY root/ /

# app runs on port 3000
EXPOSE 3000

# Configure DNSMASQ
RUN chmod a+x /etc/cont-init.d/*
