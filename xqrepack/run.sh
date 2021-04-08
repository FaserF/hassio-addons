#!/usr/bin/with-contenv bashio
firmware_path=$(bashio::config 'firmware_path')
firmware_name=$(bashio::config 'firmware_name')
firmware_name_new=r3600-raw-img.bin

cd /xqrepack

echo "Extracting Firmware Image $firmware_path"
ubireader_extract_images -w $firmware_path/$firmware_name

echo "Patch the rootfs using the @geekman repack-squashfs.sh script"
rootfs_name=$(find ./ubifs-root/$firmware_name/ -maxdepth 1 -name "*vol-ubi_rootfs.ubifs*" -print)
echo "Rootfs was detected: $rootfs_name"
chmod -R 755 ./
chmod -R 755 /tmp/
fakeroot -- ./repack-squashfs.sh $rootfs_name

echo "Recombine the kernel and patched rootfs with @geekman ubinize.sh"
rootfs_kernel_name=$(find ./ubifs-root/$firmware_name/ -maxdepth 1 -name "*vol-kernel.ubifs*" -print)
echo "rootfs_kernel_name was detected: $rootfs_kernel_name"
rootfs_new_name=$(find ./ubifs-root/$firmware_name/ -maxdepth 1 -name "*ubi_rootfs.ubifs.new*" -print)
echo "rootfs_new_name was detected: $rootfs_new_name"
chmod -R 755 ./
./ubinize.sh $rootfs_kernel_name $rootfs_new_name

echo "Copying new firmware file $firmware_name_new to $firmware_path"

mv $firmware_name_new $firmware_path