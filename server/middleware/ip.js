function extractIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.connection?.remoteAddress
    || req.ip
    || 'unknown';
}

function trackIP(req, res, next) {
  req.clientIP = extractIP(req);
  next();
}

module.exports = { extractIP, trackIP };
