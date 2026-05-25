FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    openssl \
    zip \
    ca-certificates \
    bash \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN python3 -m venv .venv \
  && .venv/bin/pip install --no-cache-dir -r requirements.txt

COPY imessage-agent/package.json imessage-agent/package-lock.json ./imessage-agent/
RUN npm ci --prefix imessage-agent

COPY . .

ENV NODE_ENV=production
ENV USE_TERMINAL=false

CMD ["bash", "scripts/railway-start.sh"]
