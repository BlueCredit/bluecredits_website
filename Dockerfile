FROM nginx:alpine

# nginx on Cloud Run must listen on 8080 (PORT env var)
RUN sed -i 's/listen\s*80;/listen 8080;/' /etc/nginx/conf.d/default.conf

# Copy static site files into nginx web root
COPY . /usr/share/nginx/html

# Remove git/config files from the served directory
RUN rm -f /usr/share/nginx/html/CNAME \
          /usr/share/nginx/html/README.md \
          /usr/share/nginx/html/Dockerfile \
          /usr/share/nginx/html/cloudbuild.yaml

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
