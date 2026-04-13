FROM node:20-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      build-essential \
      ffmpeg \
      git \
      libglib2.0-0 \
      libsm6 \
      libxext6 \
      libxrender1 \
      ninja-build \
      python-is-python3 \
      python3 \
      python3-pip \
      python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

RUN python -m venv "$VIRTUAL_ENV" \
    && pip install --upgrade pip setuptools wheel

COPY requirements-vision-base.txt requirements-xiaoxiae.txt ./
RUN pip install -r requirements-xiaoxiae.txt

COPY . .

RUN python -m compileall vision_service

EXPOSE 5000

CMD ["node", "server.js"]
