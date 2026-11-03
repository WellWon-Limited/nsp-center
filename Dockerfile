# Dev deployment image for Coolify: builds the prerendered site and serves it
# with scripts/serve.mjs (redirects, PAGEN_1 pagination, 404 page).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated/content.json ./src/generated/content.json
COPY --from=build /app/scripts/serve.mjs /app/scripts/prototype-adapter.mjs ./scripts/
COPY --from=build ["/app/assets/NSP App Prototype.html", "./assets/"]
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:4173/ || exit 1
CMD ["node", "scripts/serve.mjs"]
