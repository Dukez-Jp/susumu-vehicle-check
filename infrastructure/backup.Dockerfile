FROM postgres:18.6-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /tools
COPY scripts/backup_restore.py /tools/backup_restore.py
ENTRYPOINT ["python3", "/tools/backup_restore.py"]
