#!/usr/bin/with-contenv bashio
firmware_path=$(bashio::config 'firmware_path')
firmware_name=$(bashio::config 'firmware_name')
firmware_name_new=r3600-raw-img.bin
rm1800=false

if [ ! -f "$firmware_path$firmware_name" ]; then
	echo "$firmware_path$firmware_name does not exist. Exiting..."
	exit
fi

if [[ $firmware_name == *"rm1800"* ]] || [ "$firmware_name" = *"ax1800"* ]; then
	firmware_name_new_rm1800=rm1800-raw-img.bin
	rm1800=true
	echo "Detected rm1800 firmware name. Will append --data to ubinze.sh script"
else
	echo "Did not detect a rm1800 firmware, will start the process with the default xqrepack settings."
	echo "If you tried to use it with a rm1800 image, do NOT flash the image and restart the addon with the firmware_name rm1800 inside."
fi

cd /xqrepack

echo "Extracting Firmware Image $firmware_path$firmware_name"
ubireader_extract_images -w $firmware_path$firmware_name

echo "-------------------------------------------------------------"
echo "Patch the rootfs using the @geekman repack-squashfs.sh script"
rootfs_name=$(find ./ubifs-root/$firmware_name/ -maxdepth 1 -name "*vol-ubi_rootfs.ubifs*" -print)
echo "Rootfs was detected: $rootfs_name"
chmod -R 755 ./
chmod -R 755 /tmp/
fakeroot -- ./repack-squashfs.sh $rootfs_name

echo "-------------------------------------------------------------"
echo "Recombine the kernel and patched rootfs with @geekman ubinize.sh"
rootfs_kernel_name=$(find ./ubifs-root/$firmware_name/ -maxdepth 1 -name "*vol-kernel.ubifs*" -print)
echo "rootfs_kernel_name was detected: $rootfs_kernel_name"
rootfs_new_name=$(find ./ubifs-root/$firmware_name/ -maxdepth 1 -name "*ubi_rootfs.ubifs.new*" -print)
echo "rootfs_new_name was detected: $rootfs_new_name"
chmod -R 755 ./
if [ $rm1800 = "true" ]; then
	echo "starting ubinize.sh with --data for the rm1800 image now..."
	./ubinize.sh $rootfs_kernel_name $rootfs_new_name --data
else
	echo "starting ubinize.sh for the r3600 image now..."
	./ubinize.sh $rootfs_kernel_name $rootfs_new_name
fi

echo "-------------------------------------------------------------"
if [ $rm1800 = "true" ]; then
	echo "Copying new firmware file $firmware_name_new to $firmware_path$firmware_name_new_rm1800"
	if test -f "$firmware_path$firmware_name_new_rm1800"; then
		echo "$firmware_path$firmware_name_new_rm1800 exists already, deleting old firmware image!"
		rm $firmware_path$firmware_name_new_rm1800
	fi
	mv $firmware_name_new $firmware_path$firmware_name_new_rm1800
else
	echo "Copying new firmware file $firmware_name_new to $firmware_path"
	if test -f "$firmware_path$firmware_name_new"; then
		echo "$firmware_path$firmware_name_new exists already, deleting old firmware image!"
		rm $firmware_path$firmware_name_new
	fi
	mv $firmware_name_new $firmware_path
fi
