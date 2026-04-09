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

	# --- Ingress Patch Start (v10: Surgical Slasher) ---
	$self->hook(before_dispatch => sub {
		my ($c) = @_;
		
		my $prefix = $c->req->headers->header("X-Ingress-Path");
		my $fproto = $c->req->headers->header("X-Forwarded-Proto") // 'http';

		# Protocol detection
		if ($fproto && $fproto eq 'https') {
			$c->req->url->base->scheme("https");
		} else {
			$c->req->url->base->scheme("http");
		}

		# Ingress Path Support
		if ($prefix) {
			$prefix =~ s{/+$}{}; 
			# Apply the prefix to the base path with trailing slash
			$c->req->url->base->path->parse("$prefix/");
			$c->req->url->base->port(undef);
		}
	});

	$self->hook(after_dispatch => sub {
		my ($c) = @_;
		
		# Nuclear CSP cleanup
		$c->res->headers->remove("Content-Security-Policy");
		$c->res->headers->remove("X-Content-Security-Policy");
		
		# Permissive policy (v7 based)
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
        print "Successfully applied Ingress Patch v10 to $file.\n";
    } else {
        die "Error: Startup method signature not found in $file.\n";
    }
}

# 2. Surgical Template Relativizer (Sweep v10.1)
print "Starting Surgical Template Relativization (v10.1)...\n";

# Using q() to avoid quote confusion in the patterns array
my @patterns = (
    [ q("/static/),  q("static/) ],
    [ q('/static/),  q('static/) ],
    [ q("/dyn/),     q("dyn/) ],
    [ q('/dyn/),     q('dyn/) ],
    [ q("/Station/), q("Station/) ],
    [ q('/Station/), q('Station/) ],
    [ q(href="/"),   q(href="./") ],
    [ q(action="/"), q(action="./") ],
    [ q("/_),        q("./_) ],
    [ q('/_),        q('./_) ],
);

foreach my $p (@patterns) {
    my ($from, $to) = @$p;
    print "  Relativizing: $from -> $to\n";
    # Scan templates
    system("find /app/templates -type f -exec sed -i \"s|$from|$to|g\" {} +");
    # Scan public assets
    system("find /app/public -type f -exec sed -i \"s|$from|$to|g\" {} +");
}

# Special patch for absolute font/icon paths inside CSS
system("find /app/public -type f -name '*.css' -exec sed -i 's|url(\"/static/|url(\"../|g' {} +");
system("find /app/public -type f -name '*.css' -exec sed -i 's|url(/static/|url(../|g' {} +");

print "Surgical Relativization complete.\n";
