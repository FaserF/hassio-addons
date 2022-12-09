# Changelog

## 2.4.8
- bump hassio-addon-base to V12.2.7
- prepare support for pecl ssh2 (not working yet)

## 2.4.7
- fixed opcache creation dir error
- free up some more space by outsourcing addon screenshots

## 2.4.6
- fixed an error where config parameters could not be read and lead to an error after starting the addon
- fixed an error with php opcache

## 2.4.5
- add support for pdo_sqlite
- bump hassio-addon-base to V12.2.4

## 2.4.4
- add support for xdebug

## 2.4.3
- fix installation error caused by mosquitto

## 2.4.2
- bump hassio-addon-base to V12.2.2

## 2.4.1
- fix custom php path not working since php8.1 update

## 2.4.0
- fix update error
- bump PHP to PHP8.1

## 2.3.0
- bump hassio-addon-base to V12.0.0

## 2.2.2
- bump hassio-addon-base to V11.1.2

## 2.2.1
- bump hassio-addon-base to V11.1.1

## 2.2.0
- bump hassio-addon-base to V11.0.0

## 2.1.3
- bump hassio-addon-base to V10.2.0

## 2.1.2
- bump hassio-addon-base to V10.1.0

## 2.1.1
- bump hassio-addon-base to V10.0.1

## 2.1.0
- bump hassio-addon-base to V10.0.0
- fixed an issue in the php7-locales which resulted in an issue while installing the addon

## 2.0.4
- add php7-ctype support

## 2.0.3
- Enable Apache Foreground Logging

## 2.0.2
- ability to set a username and password to access the webfiles

## 2.0.1
- add php7-locales support
- add Mosquitto-PHP support

## 2.0.0
- add php7-xml support
- this addon is now available in three variants:
Minimal
Minimal with MariaDB
this "normal" version with common used PHP Modules

## 1.7.2
- fixed error: can't find custom config

## 1.7.1
- fixed error: can't find custom web root folder

## 1.7.0
- add php7-session php7-intl php7-soap php7-session php7-fileinfo support

## 1.6.0
- add php7-iconv and php7-dom support

## 1.5.1
- add option to receive a apache2 config copy
- fix PHP7-PDO syntax error in Dockerfile

## 1.5.0
- add PHP7-PDO package

## 1.4.0
- allow the usage of custom apache2 config files

## 1.3.0
- allow the usage of a custom php.ini file

## 1.2.3
- add /media folder as a root folder option

## 1.2.2
- hotfix update for ssl path not working

## 1.2.1
- enabled use of .htaccess files

## 1.2.0
- new option document_root -> Allowing the user to decide the document root folder
- added default index.html if the user has no webfiles in the correct folder

## 1.1.2
- added php-mcrypt, php-zip
- Ingress is now supported

## 1.1.1
- added mariadb-client to docker image

## 1.1.0
- New Icon
- Prepared Ingress Support

## 1.0.1
- Fixed SSL
- Removed MariaDB Options

## 1.0.0
- Initial release
