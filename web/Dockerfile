# Usar una imagen base de Nginx ligera
FROM nginx:alpine

# Eliminar la configuración por defecto de Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar nuestros archivos estáticos al directorio raíz de Nginx
# Asumimos que los archivos estáticos están en api/api/static
COPY ../api/api/static /usr/share/nginx/html

# Exponer el puerto 80 (puerto estándar de Nginx)
EXPOSE 80

# El comando por defecto de la imagen de Nginx ya inicia el servidor, así que no se necesita CMD.
