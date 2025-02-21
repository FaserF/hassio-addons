#!/usr/bin/env bashio
website_name=$(bashio::config 'website_name')
key_file=/ssl/key_openssl.pem
cert_file=/ssl/cert_openssl.pem

if test -f "$key_file"; then
	echo "$key_file exists already. A new one will now be created!"
	rm $key_file
fi

if test -f "$cert_file"; then
	echo "$cert_file exists already. A new one will now be created!"
	rm $cert_file
fi

openssl req -x509 -newkey rsa:4096 -keyout $key_file -out $cert_file -days 10000 -nodes -subj /CN=$website_name

echo "Certificates were generated. They are now located here: $key_file & $cert_file . The addon will now be stopped."
exit
