FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci --ignore-scripts

EXPOSE 3000

CMD ["npm", "run", "dev", "--workspace=@universal-cart/web"]
