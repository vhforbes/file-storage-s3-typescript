FROM oven/bun:1.3.11

RUN apt-get update && apt-get install -y \
    sqlite3 \
    ffmpeg \
    xxd \
    && rm -rf /var/lib/apt/lists/*