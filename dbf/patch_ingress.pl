#!/usr/bin/env perl
use strict;
use warnings;

my $file = shift or die "Usage: $0 <file>\n";

if (!-f $file) {
    die "Error: File $file not found!\n";
}

# 1. Patch the DBInfoscreen.pm logic
open my $fh, '<', $file or die "Can't open $file for reading: $!\n";
my $content = do { local $/; <$fh> };
close $fh;

my $hook_code = <<'EOF';

	# --- Ingress Patch Start (v11: Surgical Slasher) ---
	$self->hook(before_dispatch => sub {
		my ($c) = @_;
		
		my $prefix = $c->req->headers->header("X-Ingress-Path");
		my $fproto = $c->req->headers->header("X-Forwarded-Proto") // 'http';
		my $fhost  = $c->req->headers->header("X-Forwarded-Host")  // $c->req->headers->header("Host");

		# Host and port detection
		if ($fhost) {
			if ($fhost =~ /^([^:]+):(\d+)$/) {
				$c->req->url->base->host($1);
				$c->req->url->base->port($2);
			} else {
				$c->req->url->base->host($fhost);
				$c->req->url->base->port(undef);
			}
		}

		# Protocol detection
		if ($fproto && $fproto eq 'https') {
			$c->req->url->base->scheme("https");
		} else {
			$c->req->url->base->scheme("http");
		}

		# Ingress Path Support
		if ($prefix) {
			$prefix =~ s{/+$}{};
			$c->req->url->base->path->parse("$prefix/");
		}
	});

	$self->hook(after_dispatch => sub {
		my ($c) = @_;
		
		# Rewrite redirect Location header under Ingress
		my $prefix = $c->req->headers->header("X-Ingress-Path");
		if ($prefix) {
			$prefix =~ s{/+$}{};
			if (my $loc = $c->res->headers->location) {
				if ($loc =~ m{^/} && $loc !~ m{^\Q$prefix\E(/|$)}) {
					$c->res->headers->location("$prefix$loc");
				}
			}
		}

		# Nuclear CSP cleanup
		$c->res->headers->remove("Content-Security-Policy");
		$c->res->headers->remove("X-Content-Security-Policy");
		
		# Permissive policy
		$c->res->headers->header("Content-Security-Policy" => 
			"connect-src *; " .
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'; " .
			"img-src * data:; " .
			"style-src 'self' 'unsafe-inline'"
		);
		
		$c->res->headers->header("X-Frame-Options" => "ALLOWALL");
	});
	# --- Ingress Patch End ---
EOF

# Reset file to original state if it was already patched
$content =~ s/\n\s*# --- Ingress Patch Start.*?# --- Ingress Patch End ---\n//gs;

if ($content !~ /Ingress Patch Start/) {
    # Match the sub startup declaration specifically
    if ($content =~ s/(sub startup \{\r?\n\s*my \(\$self\) = \@_;)/$1$hook_code/s) {
        open my $wh, '>', $file or die "Can't open $file for writing: $!\n";
        print $wh $content;
        close $wh;
        print "Successfully applied Ingress Patch v11 to $file.\n";
    } else {
        die "Error: Startup method signature not found in $file.\n";
    }
}

# 2. Surgical Template Relativizer (Sweep v11: Native Perl Edition)
print "Starting Surgical Template Relativization (v11: Native Perl)...\n";

use File::Find;

my @patterns = (
    [ qr(="/static/),  q(="static/) ],
    [ qr(='/static/),  q(='static/) ],
    [ qr(="/dyn/),     q(="dyn/) ],
    [ qr(='/dyn/),     q(='dyn/) ],
    [ qr(="/Station/), q(="Station/) ],
    [ qr(='/Station/), q(='Station/) ],
    [ qr(href="/"),   q(href="./") ],
    [ qr(action="/"), q(action="./") ],
    [ qr(href="/_backend"), q(href="_backend") ],
    [ qr(href="/_autostop"), q(href="_autostop") ],
    [ qr(href="/_about"), q(href="_about") ],
    [ qr(href="/_datenschutz"), q(href="_datenschutz") ],
    [ qr(href="/_impressum"), q(href="_impressum") ],
    [ qr(href="\./_(about|datenschutz|impressum)"), q(href="_$1") ],
    [ qr('/static/<%=\$av%>/css/'), q('static/<%=$av%>/css/') ],
    [ qr('\./_geolocation'), q('_geolocation') ],
    [ qr('/_geolocation'), q('_geolocation') ],
    [ qr('/_ajax_mapinfo/'), q('_ajax_mapinfo/') ],
);

sub process_files {
    my $dir = shift;
    return unless -d $dir;
    
    find(sub {
        return unless -f $_;
        my $fname = $File::Find::name;
        
        # Read file
        open my $rfh, '<', $_ or return;
        my $fcontent = do { local $/; <$rfh> };
        close $rfh;
        
        my $changed = 0;
        
        # Apply patterns
        foreach my $p (@patterns) {
            my ($from, $to) = @$p;
            if ($fcontent =~ s/$from/$to/g) {
                $changed = 1;
            }
        }
        
        # Special CSS patch
        if ($fname =~ /\.css$/) {
            if ($fcontent =~ s/url\("?\/static\//url\("..\/static\//g) {
                $changed = 1;
            }
        }

        # Write back if changed
        if ($changed) {
            open my $wfh, '>', $_ or die "Can't write to $fname: $!\n";
            print $wfh $fcontent;
            close $wfh;
            print "  Relativized: $fname\n";
        }
    }, $dir);
}

process_files("/app/templates");
process_files("/app/public");

print "Surgical Relativization complete.\n";
