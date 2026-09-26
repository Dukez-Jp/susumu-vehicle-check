FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore with the manifests only: this layer is invalidated when a dependency
# changes, not on every code edit. Copying backend/ first re-downloaded NuGet
# packages on each build.
COPY backend/NuGet.config backend/Directory.Build.props ./backend/
COPY backend/src/Susumu.Domain/Susumu.Domain.csproj ./backend/src/Susumu.Domain/
COPY backend/src/Susumu.Infrastructure/Susumu.Infrastructure.csproj ./backend/src/Susumu.Infrastructure/
COPY backend/src/Susumu.Api/Susumu.Api.csproj ./backend/src/Susumu.Api/
RUN dotnet restore backend/src/Susumu.Api/Susumu.Api.csproj

# Production sources only; backend/tests neither enters the image nor
# invalidates the restore layer.
COPY backend/src/ ./backend/src/
RUN dotnet publish backend/src/Susumu.Api/Susumu.Api.csproj -c Release --no-restore -o /out /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

# curl exists only for the HEALTHCHECK: the aspnet image ships no HTTP client,
# and without a probe Compose cannot wait for the API before starting Caddy.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

ENV ASPNETCORE_HTTP_PORTS=8080
RUN mkdir -p /data/photos /data/dev-seed && chown -R app:app /data/photos /data/dev-seed
COPY --from=build /out .
USER app
EXPOSE 8080

# /health/ready answers 503 while the database is unreachable. Intervals stay
# short because CI runs `docker compose up --wait --wait-timeout 120`.
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 \
  CMD curl -fsS http://127.0.0.1:8080/health/ready || exit 1

ENTRYPOINT ["dotnet", "Susumu.Api.dll"]
