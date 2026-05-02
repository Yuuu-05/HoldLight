FROM node:20-bullseye

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

RUN set -eux; \
    echo 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/80-retries; \
    echo 'Acquire::http::Timeout "120";' >> /etc/apt/apt.conf.d/80-retries; \
    echo 'Acquire::https::Timeout "120";' >> /etc/apt/apt.conf.d/80-retries; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      build-essential \
      ffmpeg \
      git \
      libglib2.0-0 \
      libsm6 \
      libxext6 \
      libxrender1 \
      python-is-python3 \
      python3 \
      python3-pip \
      python3-venv; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

RUN python -m venv "$VIRTUAL_ENV" \
    && pip install --upgrade pip setuptools wheel

COPY requirements-vision-base.txt ./
RUN python --version \
    && pip --version \
    && pip install -r requirements-vision-base.txt

RUN pip install torch==1.10.1+cpu torchvision==0.11.2+cpu \
    -f https://download.pytorch.org/whl/cpu/torch_stable.html

RUN pip install detectron2==0.6 \
    -f https://dl.fbaipublicfiles.com/detectron2/wheels/cpu/torch1.10/index.html

COPY . .

RUN python scripts/verifyVisionAssets.py --allow-missing-downloadable

RUN python -m compileall vision_service

RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]

EXPOSE 5000

CMD ["node", "server.js"]
