const createRateLimiter = (maxRequests, windowMs, safetyBuffer = 10) => {
  let requests = [];

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const waitIfNeeded = async () => {
    const now = Date.now();
    requests = requests.filter(time => now - time < windowMs);

    if(requests.length >= maxRequests - safetyBuffer) {
      const oldestRequest = requests[0];
      const waitTime = windowMs - (now - oldestRequest) + 1000;

      if(waitTime > 0) {
        console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
        await sleep(waitTime);
      }
    }

    requests.push(now);
  };

  const getRequestsRemaining = () => {
    const now = Date.now();
    requests = requests.filter(time => now - time < windowMs);
    return Math.max(0, maxRequests - safetyBuffer - requests.length);
  };

  return { waitIfNeeded, getRequestsRemaining };
};

module.exports = createRateLimiter;
