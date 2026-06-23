# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json packages/shared/
COPY packages/client/package*.json packages/client/
COPY packages/server/package*.json packages/server/
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Migrate (used by docker-compose migrate service)
FROM build AS migrate
WORKDIR /app/packages/server

# Stage 3: Production
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/package*.json ./
COPY --from=build /app/packages/shared/package*.json packages/shared/
COPY --from=build /app/packages/server/package*.json packages/server/
COPY --from=build /app/packages/client/package*.json packages/client/
RUN npm ci --omit=dev
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/client/dist packages/client/dist
# Upload directory; the named volume mounted here inherits this ownership so
# the unprivileged app user can write to it.
RUN mkdir -p /data/uploads && chown -R app:app /data
ENV UPLOAD_DIR=/data/uploads
USER app
EXPOSE 3000
CMD ["node", "packages/server/dist/index.js"]
