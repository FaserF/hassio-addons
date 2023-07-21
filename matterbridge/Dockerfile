ARG BUILD_FROM=ghcr.io/hassio-addons/base:14.0.5
# hadolint ignore=DL3006
FROM ${BUILD_FROM} AS builder

RUN apk --no-cache add wget go git tar
ARG MATTERBRIDGE_VERSION="v1.26.0"

RUN wget https://github.com/42wim/matterbridge/archive/refs/tags/${MATTERBRIDGE_VERSION}.tar.gz

RUN tar xzf ${MATTERBRIDGE_VERSION}.tar.gz
RUN rm ${MATTERBRIDGE_VERSION}.tar.gz
RUN cd /matterbridge-1.26.0 \
  && CGO_ENABLED=0 go build -tags whatsappmulti -mod vendor -ldflags "-X github.com/42wim/matterbridge/version.GitHash=$(git log --pretty=format:'%h' -n 1)" -o /bin/matterbridge

FROM ${BUILD_FROM}
RUN apk --no-cache add ca-certificates mailcap
COPY --from=builder /bin/matterbridge /bin/matterbridge
RUN mkdir /etc/matterbridge \
  && touch /etc/matterbridge/matterbridge.toml \
  && ln -sf /matterbridge.toml /etc/matterbridge/matterbridge.toml

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
RUN chmod a+x /bin/matterbridge
CMD [ "/run.sh" ]
