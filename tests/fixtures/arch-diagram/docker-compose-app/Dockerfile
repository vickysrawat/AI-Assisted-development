# Fixture for /arch-diagram scenario tests (ADO-8001). Made-up application.
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 8000
CMD ["node", "server.js"]
