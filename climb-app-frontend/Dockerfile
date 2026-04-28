FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY scripts ./scripts
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api
ARG VITE_ENABLE_DEV_AUTH_BYPASS=false
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_ENABLE_DEV_AUTH_BYPASS=${VITE_ENABLE_DEV_AUTH_BYPASS}

RUN npm run build

FROM nginx:1.27-alpine

ENV PORT=10000 \
    API_UPSTREAM=climb-app-backend:10000

COPY docker-entrypoint.d /docker-entrypoint.d
RUN chmod +x /docker-entrypoint.d/*.sh
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
