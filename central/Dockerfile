# Use the official Node.js Alpine image
FROM node:22-bullseye-slim

# # Install native build tools + Python3 (for node-gyp)


# RUN apk add \
# 	build-base \
# 	python3 \
# 	python3-dev \
# 	py3-setuptools \
# 	libc6-compat \
# 	&& ln -sf python3 /usr/bin/python

# Set working directory
WORKDIR /app

# Install dependencies (with sqlite3 compiled from source)
COPY package*.json ./
RUN npm ci 

# Copy app code
COPY . .

# Expose your app port
EXPOSE 8000

# Launch
CMD ["npm", "start"]
