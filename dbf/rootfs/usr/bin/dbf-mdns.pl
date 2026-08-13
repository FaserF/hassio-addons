#!/usr/bin/env perl
# ==============================================================================
# DBF mDNS / Zeroconf Broadcaster
# Announces DBF (DB-Infoscreen) service to Home Assistant via mDNS multicast.
# ==============================================================================

use strict;
use warnings;
use IO::Socket::INET;
use Socket qw(inet_aton sockaddr_in INADDR_ANY);

my $PORT = 8092;
my $SERVICE_TYPE = "_ha-db_infoscreen._tcp.local";
my $INSTANCE_NAME = "DBF (DB-Infoscreen)";
my $FULL_NAME = "$INSTANCE_NAME.$SERVICE_TYPE";
my $HOST_NAME = "dbf.local";
my $MCAST_ADDR = "224.0.0.251";
my $MCAST_PORT = 5353;

# Determine local IP address
sub get_local_ip {
    my $sock = IO::Socket::INET->new(
        PeerAddr => '8.8.8.8',
        PeerPort => 80,
        Proto    => 'udp'
    );
    return '127.0.0.1' unless $sock;
    my $ip = $sock->sockhost();
    close($sock);
    return $ip || '127.0.0.1';
}

# Encode DNS domain name to wire format
sub encode_name {
    my ($name) = @_;
    my $encoded = '';
    for my $part (split /\./, $name) {
        $encoded .= chr(length($part)) . $part;
    }
    $encoded .= "\0";
    return $encoded;
}

# Build raw mDNS announcement response packet
sub build_announcement_packet {
    my ($ip) = @_;

    # DNS Header: ID=0, Flags=0x8400 (Standard response, Authoritative), Questions=0, Answers=4, Authority=0, Additional=0
    my $header = pack('n n n n n n', 0, 0x8400, 0, 4, 0, 0);

    my $body = '';

    # 1. PTR Record: _ha-db_infoscreen._tcp.local -> DBF._ha-db_infoscreen._tcp.local
    my $ptr_target = encode_name($FULL_NAME);
    $body .= encode_name($SERVICE_TYPE);
    $body .= pack('n n N n', 12, 0x8001, 120, length($ptr_target)) . $ptr_target;

    # 2. SRV Record: DBF._ha-db_infoscreen._tcp.local -> dbf.local:8092 (Priority=0, Weight=0, Port=8092)
    my $srv_target = encode_name($HOST_NAME);
    my $srv_rdata = pack('n n n', 0, 0, $PORT) . $srv_target;
    $body .= encode_name($FULL_NAME);
    $body .= pack('n n N n', 33, 0x8001, 120, length($srv_rdata)) . $srv_rdata;

    # 3. TXT Record: DBF._ha-db_infoscreen._tcp.local (version=1.0.0, path=/)
    my $txt_data = chr(length("version=1.0.0")) . "version=1.0.0" . chr(length("path=/")) . "path=/";
    $body .= encode_name($FULL_NAME);
    $body .= pack('n n N n', 16, 0x8001, 120, length($txt_data)) . $txt_data;

    # 4. A Record: dbf.local -> IP address
    my $ip_rdata = inet_aton($ip) || inet_aton('127.0.0.1');
    $body .= encode_name($HOST_NAME);
    $body .= pack('n n N n', 1, 0x8001, 120, 4) . $ip_rdata;

    return $header . $body;
}

# Create multicast UDP socket for sending
my $sock = IO::Socket::INET->new(
    Proto     => 'udp',
    LocalPort => 0,
    LocalAddr => '0.0.0.0',
    ReuseAddr => 1,
) or die "Cannot create UDP socket: $!\n";

# Enable broadcast / multicast TTL
setsockopt($sock, Socket::IPPROTO_IP, Socket::IP_MULTICAST_TTL, pack('C', 255));

my $dest = sockaddr_in($MCAST_PORT, inet_aton($MCAST_ADDR));

# Announce loop (every 30 seconds)
while (1) {
    eval {
        my $ip = get_local_ip();
        my $packet = build_announcement_packet($ip);
        send($sock, $packet, 0, $dest);
    };
    sleep 30;
}
