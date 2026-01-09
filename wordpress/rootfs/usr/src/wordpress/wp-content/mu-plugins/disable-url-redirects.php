<?php
/**
 * Plugin Name: Disable URL Redirects
 * Description: Disables WordPress URL redirects to allow access via IP address
 * Version: 1.0.0
 * Author: Home Assistant Add-on
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Disable WordPress URL redirects when accessing via IP address
add_filter('redirect_canonical', function($redirect_url, $requested_url) {
    // If accessing via IP address, don't redirect
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';

    // Check if host is an IP address (IPv4 or IPv6)
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        return false; // Disable redirect
    }

    // Allow normal redirects for domain names
    return $redirect_url;
}, 10, 2);

// Also disable redirects in wp_redirect
add_filter('wp_redirect', function($location, $status) {
    // If accessing via IP address, don't redirect to domain
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';

    // Check if host is an IP address
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        // If redirecting to a different host, keep the current IP
        $redirect_host = parse_url($location, PHP_URL_HOST);
        if ($redirect_host && $redirect_host !== $host) {
            // Replace the host in the redirect URL with the current IP
            $location = str_replace($redirect_host, $host, $location);
        }
    }

    return $location;
}, 10, 2);
