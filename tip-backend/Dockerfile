FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 10099

CMD ["sh", "-c", "npm run db:push && npm run start"]
