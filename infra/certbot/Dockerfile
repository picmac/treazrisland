FROM certbot/certbot:latest

RUN apt-get update \
    && apt-get install -y --no-install-recommends cron curl \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY reload-nginx.sh /usr/local/bin/reload-nginx.sh

RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/reload-nginx.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
