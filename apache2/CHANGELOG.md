# Changelog
## 2.13.1
- Automatically updated addon-base to version v17.2.5

## 2.13.0
- Updates addon-base to version v17.2.4
- add php-sockets
- optimized default index.html

## 2.12.4
- Automatically updated addon-base to version v17.2.2

## 2.12.3
- Automatically updated addon-base to version v17.2.1

## 2.12.2
- Automatically updated addon-base to version v17.2.1

## 2.12.1
- enabled the usage of own GitHub images

## 2.12.0
- Prepared using own GitHub image for backups & addon building
-> This lowers the backup sizes for this addon
-> Not yet activated, only everything has been prepared

## 2.11.1
- Automatically updated addon-base to version v17.2.1

## 2.11.0
- automatically update addon-base to version v17.0.2
- update php and it's modules to 8.4
- add support for php84-simplexml

## 2.10.3
- automatically update addon-base to version v17.0.1

## 2.10.2
- automatically update addon-base to version v17.0.0

## 2.10.1
- automatically update addon-base to version v16.3.6

## 2.10.0
- add multiple PHP extensions: php83-simplexml php83-gd php83-json php83-imap php83-apcu

## 2.9.7
- automatically update addon-base to version v16.3.5

## 2.9.6
- automatically update addon-base to version v16.3.4

## 2.9.5
- automatically update addon-base to version v16.3.3

## 2.9.4
- automatically update addon-base to version v16.3.2

## 2.9.3
- add php83-cgi

## 2.9.2
- automatically update addon-base to version v16.3.1

## 2.9.1
- automatically update addon-base to version v16.3.0

## 2.9.0
- add php-xmlwriter
- update php 8.2 and modules to php 8.3

## 2.8.4
- automatically update addon-base to version v16.2.1

## 2.8.3
- automatically update addon-base to version v16.1.3

## 2.8.2
- automatically update addon-base to version v16.0.0

## 2.8.1
- Hotfix for using wrong PHP path

## 2.8.0
- bump hassio-addon-base to version v15.0.8
- bump PHP and PHP extensions to 8.2
- add php-exif module
- add ffmpeg package

## 2.7.10
- bump hassio-addon-base to version v15.0.5

## 2.7.9
- automatically update hassio-addon-base to version v14.3.2

## 2.7.8
- automatically update hassio-addon-base to version v14.3.1

## 2.7.7
- automatically update hassio-addon-base to version v14.2.2

## 2.7.6
- automatically update hassio-addon-base to version v14.1.3

## 2.7.5
- add php81-tokenizer module

## 2.7.4
- automatically update hassio-addon-base to version v14.0.8

## 2.7.3
- automatically update hassio-addon-base to version v14.0.7

## 2.7.2
- automatically update hassio-addon-base to version 14.0.5

## 2.7.1
- automatically update hassio-addon-base to the latest version

## 2.7.0
- bump hassio-addon-base to V14.0.0
- autorelease new version updates on addon base updates

## 2.6.3
- bump hassio-addon-base to latest release
- remove php-pecl-mcrypt for now (got obsolet by alpine)

## 2.6.2
- now really fix addon wont start on empty init_commands parameter
- Switch config to yaml

## 2.6.1
- fix addon wont start on empty init_commands parameter

## 2.6.0
- add support for init_commands to use custom php, perl and so on modules

## 2.5.1
- bump hassio-addon-base to V13.1.2
- potentially fixes temporary download issues with an older Alpine version

## 2.5.0
- bump hassio-addon-base to V13.1.0

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
