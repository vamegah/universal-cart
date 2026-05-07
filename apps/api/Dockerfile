FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci --ignore-scripts
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

EXPOSE 3001

CMD ["npm", "run", "dev", "--workspace=@universal-cart/api"]
