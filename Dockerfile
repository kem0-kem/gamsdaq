# Stage 1: Build Vite TypeScript Web frontend
FROM node:22-alpine AS web-build
WORKDIR /src/gamsdaq-web

COPY src/gamsdaq-web/package*.json ./
RUN npm ci

COPY src/gamsdaq-web/ ./
RUN npm run build

# Stage 2: Build and publish .NET 10 Web API with static frontend assets
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src/Gamsdaq.Api

COPY src/Gamsdaq.Api/Gamsdaq.Api.csproj ./
RUN dotnet restore "Gamsdaq.Api.csproj"

COPY src/Gamsdaq.Api/ ./
COPY --from=web-build /src/gamsdaq-web/dist ./wwwroot

RUN dotnet publish "Gamsdaq.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Production runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

COPY --from=api-build /app/publish ./

ENTRYPOINT ["dotnet", "Gamsdaq.Api.dll"]
