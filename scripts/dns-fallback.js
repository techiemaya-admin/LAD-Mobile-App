/**
 * Some networks (corporate Wi-Fi, ISP routers, filtered DNS appliances) answer
 * REFUSED/NXDOMAIN for Cloud Run hostnames like *.run.app. Node's default
 * resolver is the OS one, so every outbound `fetch` from the local dev proxy
 * then dies with an opaque `TypeError: fetch failed` (cause: ENOTFOUND) even
 * though the backend is perfectly healthy.
 *
 * This patches `dns.lookup` (the hook `net.connect`, and therefore `fetch`,
 * uses) so that when the system resolver fails we retry the name against
 * public DNS servers before giving up.
 *
 * Opt out with DNS_FALLBACK=0; override the servers with
 * DNS_FALLBACK_SERVERS=9.9.9.9,149.112.112.112
 */
const dns = require('node:dns');

const FALLBACK_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'SERVFAIL',
  'REFUSED',
  'ENODATA',
  'NOTFOUND',
]);

const CACHE_TTL_MS = 60_000;

function install() {
  if (process.env.DNS_FALLBACK === '0' || dns.lookup.__dnsFallbackInstalled) {
    return;
  }

  const servers = (process.env.DNS_FALLBACK_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!servers.length) {
    return;
  }

  const resolver = new dns.Resolver();
  resolver.setServers(servers);

  const cache = new Map();
  const warned = new Set();

  function resolveViaFallback(hostname, callback) {
    const cached = cache.get(hostname);
    if (cached && cached.expiresAt > Date.now()) {
      callback(null, cached.records);
      return;
    }

    resolver.resolve4(hostname, (error4, addresses4) => {
      if (!error4 && addresses4 && addresses4.length) {
        finish(addresses4.map((address) => ({ address, family: 4 })));
        return;
      }

      resolver.resolve6(hostname, (error6, addresses6) => {
        if (!error6 && addresses6 && addresses6.length) {
          finish(addresses6.map((address) => ({ address, family: 6 })));
          return;
        }

        callback(error6 || error4 || new Error(`Unable to resolve ${hostname}`));
      });
    });

    function finish(records) {
      cache.set(hostname, { records, expiresAt: Date.now() + CACHE_TTL_MS });

      if (!warned.has(hostname)) {
        warned.add(hostname);
        console.warn(
          `[dns-fallback] System DNS could not resolve ${hostname}; using ${servers.join(', ')} instead.`,
        );
      }

      callback(null, records);
    }
  }

  const systemLookup = dns.lookup;

  function patchedLookup(hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    const opts = typeof options === 'number' ? { family: options } : options || {};

    return systemLookup(hostname, opts, (error, ...rest) => {
      if (!error || !FALLBACK_ERROR_CODES.has(error.code)) {
        callback(error, ...rest);
        return;
      }

      resolveViaFallback(hostname, (fallbackError, records) => {
        if (fallbackError) {
          callback(error);
          return;
        }

        const wanted = opts.family === 4 || opts.family === 6 ? opts.family : null;
        const matching = wanted ? records.filter((record) => record.family === wanted) : records;

        if (!matching.length) {
          callback(error);
          return;
        }

        if (opts.all) {
          callback(null, matching);
          return;
        }

        callback(null, matching[0].address, matching[0].family);
      });
    });
  }

  patchedLookup.__dnsFallbackInstalled = true;
  dns.lookup = patchedLookup;

  // dns.promises.lookup is a separate implementation; keep the two in sync so
  // anything awaiting it gets the same fallback.
  const systemLookupAsync = dns.promises.lookup;
  const patchedLookupAsync = (hostname, options) =>
    new Promise((resolve, reject) => {
      patchedLookup(hostname, options || {}, (error, address, family) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(options && options.all ? address : { address, family });
      });
    });
  patchedLookupAsync.__dnsFallbackInstalled = true;
  patchedLookupAsync.__systemLookupAsync = systemLookupAsync;
  dns.promises.lookup = patchedLookupAsync;
}

module.exports = { install };
