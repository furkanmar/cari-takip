# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g @nestjs/cli

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
