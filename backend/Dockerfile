# SUSUMU Vehicle Check API. Build context is the backend/ directory.
# The root coordinator owns compose/infrastructure and may adapt this file.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY NuGet.config Directory.Build.props ./
COPY src/Susumu.Domain/Susumu.Domain.csproj src/Susumu.Domain/
COPY src/Susumu.Infrastructure/Susumu.Infrastructure.csproj src/Susumu.Infrastructure/
COPY src/Susumu.Api/Susumu.Api.csproj src/Susumu.Api/
RUN dotnet restore src/Susumu.Api/Susumu.Api.csproj

COPY src/ src/
RUN dotnet publish src/Susumu.Api/Susumu.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app ./

# Attachment bytes are a volume, never part of the image or the database.
RUN mkdir -p /var/lib/susumu/photos && chown -R app:app /var/lib/susumu
VOLUME ["/var/lib/susumu/photos"]

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=5080 \
    SUSUMU_PHOTO_ROOT=/var/lib/susumu/photos

EXPOSE 5080
USER app

# SUSUMU_JWT_SIGNING_KEY and SUSUMU_DB_CONNECTION must be supplied by the deployment; the API
# refuses to start without them and there is no default credential in the image.
#
# No HEALTHCHECK is declared here: the runtime image has no HTTP client, so the probe belongs in
# compose or the orchestrator, pointing at GET /health/ready (503 while the database is unreachable).
ENTRYPOINT ["dotnet", "Susumu.Api.dll"]
