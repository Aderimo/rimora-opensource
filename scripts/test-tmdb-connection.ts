
import dns from 'node:dns';
import { promisify } from 'node:util';

const lookup = promisify(dns.lookup);
const resolve4 = promisify(dns.resolve4);

async function testConnection() {
    console.log('Testing connectivity to api.themoviedb.org...');

    try {
        // Standard lookup
        const address = await lookup('api.themoviedb.org');
        console.log('Standard Lookup Result:', address);

        // Check if localhost
        if (address.address === '127.0.0.1' || address.address === '::1') {
            console.log('Detected localhost resolution! Trying to bypass...');

            // Manual resolve using specific server is not directly supported by node:dns.
            // We can simulated it by just trying to fetch with a known IP if we had one,
            // but for now, let's just see if dns.resolve (which uses network DNS, ignoring hosts usually?) works.
            // dns.resolve uses the system resolver but might behave differently than dns.lookup (which uses getaddrinfo and respects hosts).

            try {
                // Force Google DNS
                try {
                    dns.setServers(['8.8.8.8', '8.8.4.4']);
                    console.log('Set DNS servers to Google DNS');
                } catch (err) {
                    console.error('Failed to set DNS servers:', err);
                }

                const ips = await resolve4('api.themoviedb.org');
                console.log('dns.resolve4 (Google DNS) Result:', ips);

                if (ips && ips.length > 0) {
                    const ip = ips[0];
                    console.log(`Trying to fetch via IP: ${ip}`);
                    // Modify URL to use IP, but keep Host header for SNI
                    // Note: Node's fetch might complain about SSL info if hostname doesn't match cert.
                    // We'll see.

                    // Construct URL with IP
                    // But we need to handle SNI.
                    // In Undici (Next.js fetch), we can't easily override SNI with simple fetch.
                    // But let's just try printing valid IPs first.
                }
            } catch (e) {
                console.error('dns.resolve4 failed:', e);
            }
        }

    } catch (err) {
        console.error('DNS Lookup Failed:', err);
    }
}

testConnection();
