FROM node:24-bookworm-slim AS build
WORKDIR /src
COPY admin-web/package.json admin-web/package-lock.json ./
RUN npm ci
COPY admin-web/ ./
# Sources under src/demo and src/measurements import the catalogue by a path
# that resolves above the project directory; keep that exact relative shape.
COPY docs/source/tenken-20260910/catalogo_pdf_100_itens.json /docs/source/tenken-20260910/
RUN npm run build

FROM caddy:2.11.4-alpine
COPY --from=build /src/dist /srv
COPY infrastructure/Caddyfile.dev /etc/caddy/Caddyfile
EXPOSE 80 443
