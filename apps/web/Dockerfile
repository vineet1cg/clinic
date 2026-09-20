FROM docker.io/library/node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN npm ci

COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web
ARG VITE_API_URL=/api/v1
ARG VITE_APP_NAME=ClinicOS
ARG VITE_CLINIC_NAME="Your Clinic"
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_CLINIC_NAME=$VITE_CLINIC_NAME
RUN npm run build --workspace @clinicos/web

FROM docker.io/library/nginx:1.29-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=nginx:nginx /app/apps/web/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
