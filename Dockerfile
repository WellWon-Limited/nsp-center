# Independent API and web images share offline data preparation, not a process.
FROM node:24-alpine AS catalog
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run content:catalog

FROM catalog AS build
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM runtime AS api
ENV API_HOST=0.0.0.0 API_PORT=8701 NSP_LOAD_ENV=0
COPY --from=catalog /app/apps/api ./apps/api
COPY --from=catalog /app/packages/domain ./packages/domain
COPY --from=catalog /app/packages/catalog/generated/content.json ./packages/catalog/generated/content.json
USER node
EXPOSE 8701
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8701/api/health || exit 1
CMD ["node", "apps/api/server.mjs"]

FROM runtime AS admin
ENV ADMIN_HOST=0.0.0.0 ADMIN_PORT=4174
COPY --from=build /app/dist-admin ./dist-admin
COPY --from=build /app/apps/admin/server.mjs ./apps/admin/server.mjs
COPY --from=build /app/scripts/api-client.mjs ./scripts/api-client.mjs
COPY --from=build /app/packages/domain ./packages/domain
USER node
EXPOSE 4174
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:4174/ || exit 1
CMD ["node", "apps/admin/server.mjs"]

FROM runtime AS web
ENV HOST=0.0.0.0 PORT=4173
COPY --from=build /app/dist ./dist
COPY --from=build /app/packages/catalog/generated/public.json ./packages/catalog/generated/public.json
COPY --from=build /app/packages/domain ./packages/domain
COPY --from=build /app/scripts/serve.mjs /app/scripts/api-client.mjs /app/scripts/catalog-pages.mjs /app/scripts/prototype-adapter.mjs /app/scripts/indexing.mjs ./scripts/
COPY --from=build /app/src/admin-path.mjs /app/src/catalog-categories.mjs ./src/
COPY --from=build ["/app/assets/NSP App Prototype.html", "./assets/"]
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:4173/ || exit 1
CMD ["node", "scripts/serve.mjs"]
