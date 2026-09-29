# 以專案根目錄為 build context（fly.toml 在根目錄）
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci -w server --omit=dev --ignore-scripts
COPY shared shared
COPY server server
ENV PORT=8080 NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start", "-w", "server"]
