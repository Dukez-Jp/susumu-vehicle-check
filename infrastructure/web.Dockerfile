FROM node:24-bookworm-slim AS build
WORKDIR /src
COPY admin-web/package.json admin-web/package-lock.json ./
RUN npm ci
COPY admin-web/ ./
RUN npm run build

FROM caddy:2.11.4-alpine
COPY --from=build /src/dist /srv
COPY infrastructure/Caddyfile.dev /etc/caddy/Caddyfile
EXPOSE 80 443
