# api/Dockerfile
FROM python:3.10-slim

# 1) Dependencias del sistema para compilar bcrypt, OpenSSL, etc.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  gcc \
  libffi-dev \
  libssl-dev \
  build-essential \
  && rm -rf /var/lib/apt/lists/*

# 2) Creamos un virtualenv e instalamos pip dentro
ENV VENV_PATH=/opt/venv
RUN python3 -m venv $VENV_PATH
ENV PATH="$VENV_PATH/bin:$PATH"

# 3) Definimos working dir y copiamos sólo el requirements
WORKDIR /app
COPY api/requirements.txt ./requirements.txt

# 4) Instalamos las dependencias Python
RUN pip install --upgrade pip \
  && pip install python-multipart \
  && pip install --no-cache-dir -r requirements.txt

# 5) Copiamos el resto de tu código fuente
COPY api/ ./

# Make entrypoint script executable
RUN chmod +x /app/wait-for-services.py

# 6) Exponemos el puerto y arrancamos Uvicorn
EXPOSE 8000
ENTRYPOINT ["/app/wait-for-services.py"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]