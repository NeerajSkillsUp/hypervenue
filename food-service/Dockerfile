# hypervenue/auth-service/Dockerfile   (port 4001)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 4003
CMD ["node", "index.js"]