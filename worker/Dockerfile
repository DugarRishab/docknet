FROM ubuntu:20.04

ARG BASE_IP=172.25.0.1     
ENV BASE_IP=${BASE_IP} 
# … install dependencies …
# 3. Update and install prerequisites
RUN --mount=type=cache,id=apt-cache,target=/var/cache/apt \
	--mount=type=cache,id=apt-lists,target=/var/lib/apt/lists \
	apt-get update && \
	DEBIAN_FRONTEND=noninteractive \
	apt-get install -y --no-install-recommends \
	git \
	curl \
	ca-certificates \
	pkg-config \
	build-essential \
	tzdata \
	&& rm -rf /var/lib/apt/lists/*

RUN echo "Asia/Kolkata" > /etc/timezone &&\
	DEBIAN_FRONTEND=noninteractive dpkg-reconfigure -f noninteractive tzdata 

# install your “stable” C++ libraries in one go
RUN --mount=type=cache,id=apt-cache,target=/var/cache/apt \
	apt-get update && \
	apt-get install -y --no-install-recommends \
	libssl-dev \
	libwebsocketpp-dev \
	libboost-all-dev \
	libcurl4-openssl-dev \
	libjsoncpp-dev \
	libsodium-dev \
	&& rm -rf /var/lib/apt/lists/*
	

WORKDIR /app
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENV HMAC_SECRET="dbicbidbicdnsonxpwqhudighsanxwqoueiobjsamopdjwqioh"
ENV ORPHAN_TTL_SEC=600
ENV ORPHAN_POOL_MAX=1000
ENV RATE_LIMIT_BASE=10.0
ENV RATE_LIMIT_BURST=20.0
ENV RATE_LIMIT_WINDOW_SEC=60
ENV MONITOR_PERIOD=5

ENTRYPOINT ["./entrypoint.sh"]
