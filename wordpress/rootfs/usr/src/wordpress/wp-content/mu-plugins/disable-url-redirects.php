<?php
/**
 * Plugin Name: Disable URL Redirects & Fix Asset URLs
 * Description: Disables WordPress URL redirects and fixes asset URLs to allow access via IP address
 * Version: 1.1.0
 * Author: Home Assistant Add-on
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Get current request host
$current_host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
$is_ip_access = filter_var($current_host, FILTER_VALIDATE_IP);

// Disable WordPress URL redirects when accessing via IP address
add_filter('redirect_canonical', function($redirect_url, $requested_url) use ($is_ip_access) {
    // If accessing via IP address, don't redirect
    if ($is_ip_access) {
        return false; // Disable redirect
    }

    // Allow normal redirects for domain names
    return $redirect_url;
}, 10, 2);

// Also disable redirects in wp_redirect
add_filter('wp_redirect', function($location, $status) use ($current_host, $is_ip_access) {
    // If accessing via IP address, don't redirect to domain
    if ($is_ip_access) {
        // If redirecting to a different host, keep the current IP
        $redirect_host = parse_url($location, PHP_URL_HOST);
        if ($redirect_host && $redirect_host !== $current_host) {
            // Replace the host in the redirect URL with the current IP
            $location = str_replace($redirect_host, $current_host, $location);
        }
    }

    return $location;
}, 10, 2);

// Fix asset URLs (CSS, JS, images) when accessing via IP
// This ensures assets load correctly even when accessing via IP address
// Also fixes URLs when accessing via different host than configured
add_filter('option_siteurl', function($value) use ($current_host, $is_ip_access) {
    if (empty($value) || empty($current_host)) {
        return $value;
    }

    $parsed = parse_url($value);
    if (!$parsed || !isset($parsed['host'])) {
        return $value;
    }

    $configured_host = $parsed['host'];

    // If accessing via IP and configured URL uses a domain, replace with current IP
    // OR if accessing via different host than configured, use current host
    if ($is_ip_access || $configured_host !== $current_host) {
        $scheme = isset($parsed['scheme']) ? $parsed['scheme'] : (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http');
        $port = isset($parsed['port']) ? ':' . $parsed['port'] : (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] != '80' && $_SERVER['SERVER_PORT'] != '443' ? ':' . $_SERVER['SERVER_PORT'] : '');
        $path = isset($parsed['path']) ? rtrim($parsed['path'], '/') : '';
        if (empty($path)) {
            $path = '/';
        }
        return $scheme . '://' . $current_host . $port . $path;
    }

    return $value;
}, 1);

add_filter('option_home', function($value) use ($current_host, $is_ip_access) {
    if (empty($value) || empty($current_host)) {
        return $value;
    }

    $parsed = parse_url($value);
    if (!$parsed || !isset($parsed['host'])) {
        return $value;
    }

    $configured_host = $parsed['host'];

    // If accessing via IP and configured URL uses a domain, replace with current IP
    // OR if accessing via different host than configured, use current host
    if ($is_ip_access || $configured_host !== $current_host) {
        $scheme = isset($parsed['scheme']) ? $parsed['scheme'] : (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http');
        $port = isset($parsed['port']) ? ':' . $parsed['port'] : (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] != '80' && $_SERVER['SERVER_PORT'] != '443' ? ':' . $_SERVER['SERVER_PORT'] : '');
        $path = isset($parsed['path']) ? rtrim($parsed['path'], '/') : '';
        if (empty($path)) {
            $path = '/';
        }
        return $scheme . '://' . $current_host . $port . $path;
    }

    return $value;
}, 1);
