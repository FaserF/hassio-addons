ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM} AS builder

# hadolint ignore=DL3018
RUN apk --no-cache add wget go git tar
ARG MATTERBRIDGE_VERSION="v1.26.0"

WORKDIR /matterbridge
RUN wget -qO- https://github.com/42wim/matterbridge/archive/refs/tags/${MATTERBRIDGE_VERSION}.tar.gz | tar xz --strip-components=1 \
  && CGO_ENABLED=0 go build -tags whatsappmulti -mod vendor -ldflags "-X github.com/42wim/matterbridge/version.GitHash=$(git log --pretty=format:'%h' -n 1)" -o /bin/matterbridge

FROM ${BUILD_FROM}
# hadolint ignore=DL3018
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
