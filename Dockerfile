FROM node:22-bookworm-slim AS build
WORKDIR /opt/stackedit

COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . /opt/stackedit
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-dejavu \
    fonts-lato \
    fonts-liberation \
    pandoc \
    texlive-xetex \
    wkhtmltopdf \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/stackedit

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts \
  && npm cache clean --force

COPY index.js ./
COPY config ./config
COPY server ./server
COPY static ./static
COPY --from=build /opt/stackedit/dist ./dist

USER node

EXPOSE 8080

CMD [ "node", "." ]
