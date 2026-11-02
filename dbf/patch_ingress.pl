#!/usr/bin/env perl
use strict;
use warnings;
use File::Find;

my $file = shift or die "Usage: $0 <file>\n";

if (!-f $file) {
    die "Error: File $file not found!\n";
}

# 1. Patch the DBInfoscreen.pm logic
open my $fh, '<', $file or die "Can't open $file for reading: $!\n";
my $content = do { local $/; <$fh> };
close $fh;

my $hook_code = <<'EOF';

	# --- Ingress Patch Start (v12: Dynamic Ingress Engine) ---
	# Wrap url_for to ensure paths generated have leading slashes when under Ingress
	my $orig_url_for = \&Mojolicious::Controller::url_for;
	{
		no warnings 'redefine';
		*Mojolicious::Controller::url_for = sub {
			my $c = shift;
			my $url = $c->$orig_url_for(@_);
			if (ref $url && $url->isa('Mojo::URL')) {
				if (!$url->is_abs && defined $url->path && !$url->path->leading_slash) {
					$url->path->leading_slash(1);
				}
			}
			return $url;
		};
	}

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

		# Ingress Path Support & Path Normalization
		if ($prefix) {
			$prefix =~ s{/+$}{};
			$c->req->url->base->path->parse("$prefix/");
			my $req_path = $c->req->url->path->to_string;
			if ($req_path =~ s{^\Q$prefix\E(?=/|$)}{}) {
				$req_path = '/' if $req_path eq '';
				$c->req->url->path->parse($req_path);
			}
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

		# Permissive CSP for Ingress embedded iframes
		$c->res->headers->remove("Content-Security-Policy");
		$c->res->headers->remove("X-Content-Security-Policy");
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
        print "Successfully applied Ingress Patch v12 to $file.\n";
    } else {
        die "Error: Startup method signature not found in $file.\n";
    }
}

# 2. Template and Asset Relativization
print "Starting Surgical Template Relativization (v12)...\n";

# In public static scripts, convert root-relative API calls to relative or base-aware
# 1) geostop.min.js: $.post("/_geolocation" -> $.post("_geolocation"
# 2) geostop.js: $.post('/_geolocation' -> $.post('_geolocation'
# 3) map-refresh.min.js: $.get("/_ajax_mapinfo/" -> $.get("_ajax_mapinfo/"
# 4) map-refresh.js: $.get('/_ajax_mapinfo/' -> $.get('_ajax_mapinfo/'

my @patterns = (
    [ qr{href="/_about"}, q{href="_about"} ],
    [ qr{href="/_datenschutz"}, q{href="_datenschutz"} ],
    [ qr{href="/_impressum"}, q{href="_impressum"} ],
    [ qr{href="/_backend"}, q{href="_backend"} ],
    [ qr{href="/_autostop"}, q{href="_autostop"} ],
    [ qr{href="/coverage/}, q{href="coverage/} ],
    [ qr{'\./_geolocation'}, q{'_geolocation'} ],
    [ qr{'/_geolocation'}, q{'_geolocation'} ],
    [ qr{"/_geolocation"}, q{"_geolocation"} ],
    [ qr{'\./_ajax_mapinfo/'}, q{'_ajax_mapinfo/'} ],
    [ qr{'/_ajax_mapinfo/'}, q{'_ajax_mapinfo/'} ],
    [ qr{"/_ajax_mapinfo/"}, q{"_ajax_mapinfo/"} ],
    [ qr{url\("/static/}, q{url("../static/} ],
    [ qr{url\(/static/}, q{url(../static/} ],
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

print "Ingress Patch v12 complete.\n";
