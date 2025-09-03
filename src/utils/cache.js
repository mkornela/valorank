const NodeCache = require('node-cache');

const cache = new NodeCache({
    stdTTL: 300,
    checkperiod: 120,
    useClones: false
});

const get = (key) => {
    return cache.get(key);
};

const set = (key, value, ttl = 300) => {
    return cache.set(key, value, ttl);
};

const del = (key) => {
    return cache.del(key);
};

const flush = () => {
    return cache.flushAll();
};

const stats = () => {
    return cache.getStats();
};

const generateKey = (prefix, ...params) => {
    return `${prefix}:${params.filter(Boolean).join(':')}`;
};

module.exports = {
    get,
    set,
    del,
    flush,
    stats,
    generateKey
};