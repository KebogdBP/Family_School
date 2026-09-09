FROM php:8.3-apache

RUN docker-php-ext-install pdo_mysql \
    && a2enmod rewrite headers \
    && sed -ri 's!/var/www/html!/var/www/html/public!g' /etc/apache2/sites-available/*.conf

WORKDIR /var/www/html
COPY uploads.ini /usr/local/etc/php/conf.d/homeedu-uploads.ini
COPY . .

EXPOSE 80
