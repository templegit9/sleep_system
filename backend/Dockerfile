FROM node:20-alpine

WORKDIR /app

# Install Python for audio processing
RUN apk add --no-cache python3 py3-pip

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]
