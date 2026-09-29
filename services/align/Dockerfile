# Align service as a Lambda container.
#
# OpenCV needs a lot of system libraries, so we use a slim Debian base and add
# only what is missing. We do not use the full opencv-python package because it
# pulls in a windowing system we do not need on a server.
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY align_service ./align_service

ENV ALIGN_HOST=0.0.0.0 \
    ALIGN_PORT=8080 \
    PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "uvicorn align_service.main:app --host 0.0.0.0 --port ${PORT}"]
