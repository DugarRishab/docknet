FROM ubuntu:20.04
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

ENTRYPOINT ["./entrypoint.sh"]
