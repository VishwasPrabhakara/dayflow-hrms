FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV HOST=0.0.0.0

EXPOSE 4000

CMD ["npm", "start"]
