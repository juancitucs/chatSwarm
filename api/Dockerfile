# api/Dockerfile
FROM python:3.10-slim

# 1) Dependencias del sistema para compilar bcrypt, OpenSSL, etc.
RUN apt-get update   && apt-get install -y --no-install-recommends   gcc   libffi-dev   libssl-dev   build-essential   iputils-ping   && rm -rf /var/lib/apt/lists/*

# 3) Definimos working dir y copiamos sólo el requirements
WORKDIR /app
COPY api/requirements.txt ./requirements.txt

# 4) Instalamos las dependencias Python into the /opt/venv virtual environment
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# 5) Copiamos el resto de tu código fuente
COPY api/ ./

# Make entrypoint script executable
RUN chmod +x /app/wait-for-services.py

# 6) Exponemos el puerto y arrancamos Uvicorn
EXPOSE 8000
ENTRYPOINT ["/app/wait-for-services.py"]
CMD ["/opt/venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
# Dummy comment to force Docker rebuild