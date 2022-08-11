
const path = require('path')
const timers = require('timers/promises')
const log = require('proc-log')
const writeJson = require('../lib/write-json.js')
const Api = require('../lib/api/index.js')
const fetchData = require('../lib/project-data.js')
const logger = require('../lib/logger.js')
const getProjectsHistory = require('../lib/projects-history.js')
const pAll = require('../lib/p-all.js')
const wwwPaths = require('www')
const config = require('../lib/config.js')

logger()
const api = Api(config)

const getFilter = (rawFilter) => {
  if (!isNaN(rawFilter) && !isNaN(parseFloat(rawFilter))) {
    return (_, index) => index < +rawFilter
  }

  const names = rawFilter.split(',').map((name) => name.trim().toLowerCase())
  return (project) => [project.pkg, project.name]
    .filter(Boolean)
    .map(t => t.toLowerCase())
    .some((t) => names.includes(t))
}

const writeData = async ({ write, repoFilter, ...restConfig }) => {
  const rawProjects = require(wwwPaths.maintained)
  // Make it easier to test by only fetching a subset of the projects
  const projects = repoFilter ? rawProjects.filter(getFilter(repoFilter)) : rawProjects

  const now = new Date()
  const dailyFile = wwwPaths.daily(now)

  const projectsHistory = await getProjectsHistory({
    projects,
    dir: wwwPaths.dailyDir,
    filter: (f) => f !== path.basename(dailyFile),
  })

  const projectsData = await pAll(projects.map((project) => () => fetchData({
    api,
    project,
    history: projectsHistory[project.id],
    ...restConfig,
  })))

  const contents = { data: projectsData, created_at: now.toISOString() }

  if (!write) {
    return JSON.stringify(contents, null, 2)
  }

  const results = await writeJson([
    { path: dailyFile, indent: 2 },
    { path: wwwPaths.latest, indent: 2 },
  ], contents)

  return results.map((f) => f.message).join('\n')
}

const main = async (retries = 1) => {
  try {
    console.log(await writeData(config))
  } catch (err) {
    log.error(err)

    if (retries <= 2) {
      retries++
      const retryDelay = config.delay ? 1000 * 60 * 2 : 0
      log.warn(`Retry number ${retries} fetch-data script in ${retryDelay}ms`)
      return timers.setTimeout(retryDelay).then(() => main(retries))
    }

    process.exitCode = 1
  }
}

main()