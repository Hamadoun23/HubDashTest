# Image de l'interface unique de GDA Hub (React + Vite).

FROM node:22-slim AS base

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000

FROM base AS developpement
# Port 3000, pas le 5173 par defaut de Vite : c'est ce que la passerelle
# nginx attend (upstream interface { server frontend:3000; }).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

FROM base AS production
RUN npm run build
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
