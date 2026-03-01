# Stage 1: Build frontend
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server ./server

RUN mkdir -p saves

EXPOSE 3000
CMD ["node", "--experimental-strip-types", "server/index.ts"]
