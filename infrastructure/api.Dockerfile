FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/ ./backend/
RUN dotnet restore backend/src/Susumu.Api/Susumu.Api.csproj
RUN dotnet publish backend/src/Susumu.Api/Susumu.Api.csproj -c Release --no-restore -o /out /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
RUN mkdir -p /data/photos /data/dev-seed && chown -R app:app /data/photos /data/dev-seed
COPY --from=build /out .
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "Susumu.Api.dll"]
