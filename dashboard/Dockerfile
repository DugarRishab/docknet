# dashboard/Dockerfile

# 1. Build React app
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2. Serve with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# copy nginx config if needed
# COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]