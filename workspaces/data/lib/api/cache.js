const log = require('proc-log')

// A memory cache for expensive requests like check-runs
// which can get called for the same commit multiple times
// in workspaces. Also used if we retry the whole thing
// again during the same process
const CACHE = new Map()

const cacheKey = (args) => args
  .filter(a => a != null)
  .map((a) => JSON.stringify(a))
  .join('__')

const cacheMethod = (fn) => {
  CACHE.set(fn, new Map())

  return async (...args) => {
    const key = cacheKey(args)

    if (CACHE.get(fn).has(key)) {
      log.info('cache', 'returning', fn.name, key)
      return CACHE.get(fn).get(key)
    }

    const res = await fn(...args)
    CACHE.get(fn).set(key, res)

    return res
  }
}

module.exports = cacheMethod
