# Stage 1: Build the Vite app
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Node.js
FROM node:18-alpine
WORKDIR /app
# We need production dependencies for Express and Cors
COPY package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
COPY server.js ./
EXPOSE 3000
CMD ["node", "server.js"]
