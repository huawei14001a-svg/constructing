FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm install
RUN npm --prefix web install --include=dev
RUN npm --prefix web run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
