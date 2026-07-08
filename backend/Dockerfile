FROM php:8.2-apache
RUN docker-php-ext-install pdo pdo_mysql mysqli
COPY ./ecommerce /var/www/html/
EXPOSE 80
