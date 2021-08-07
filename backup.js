const { Octokit } = require("@octokit/core")
const path = require("path")
const fecha = require("fecha")
const os = require("os")
const fs = require("fs")
const process = require("process")
const { URL } = require("url")
const shelljs = require("shelljs")
const { default: axios } = require("axios")
const { fstat } = require("fs")

shelljs.config.fatal = true
shelljs.config.verbose = true
const { exec } = shelljs

const { GITHUB_TOKEN, GITEA_TOKEN, GITEA_DOMAIN, GITHUB_PROXY } = process.env

if (GITHUB_TOKEN === "" || GITHUB_TOKEN === "" || GITEA_DOMAIN === "") {
  console.error(
    `must provide GITHUB_TOKEN, GITEA_TOKEN and GITEA_DOMAIN env variables`
  )
  process.exit(1)
}

// axios instance for gitea
const gitea = axios.create({
  baseURL: GITEA_DOMAIN + "/api/v1",
  headers: {
    Authorization: "token " + GITEA_TOKEN,
  },
  validateStatus: (status) => {
    return (status >= 200 && status < 300) || status === 404
  },
})

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
})

const log = console.log

const fetchGithubRepos = async (page) => {
  const res = await octokit.request("GET /user/repos", {
    per_page: 100,
    page,
  })

  return res.data.filter((r) => r.owner.login === githubUser)
}

let giteaUser = ""
let githubUser = ""

// return clone url of the repo
const getOrCreateGiteaRepo = async (name) => {
  // get the repo
  log("-- Query gitea repo info")
  const res = await gitea.get(`/repos/${giteaUser}/${name}`)

  // we need to create this repo
  if (res.status === 404) {
    log("-- Create repo for gitea")
    const res = await gitea.post("/user/repos", {
      name,
    })

    return res.data.clone_url
  }

  return res.data.clone_url
}

const backupRepos = async (repos) => {
  for (const repo of repos) {
    const { full_name, name } = repo
    log("##")
    log("## Handle repo: " + full_name)
    log("##")

    // if not exists, clone it
    if (fs.existsSync(name)) {
      log("-- Repo exists, fetch all updates")
      exec(`cd ${name} && git fetch --all`)
    } else {
      log(`-- Clone ${full_name}`)
      exec(
        `git clone --verbose ${
          GITHUB_PROXY ? `-c http.proxy=${GITHUB_PROXY}` : ""
        } https://${GITHUB_TOKEN}@github.com/${full_name}`
      )
    }

    // query gitea to get gitea url
    const giteaURL = await getOrCreateGiteaRepo(name)
    log(`Gitea url for repo: ${giteaURL}`)

    // push repo to gitea
    const parsedURL = new URL(giteaURL)
    parsedURL.username = giteaUser
    parsedURL.password = GITEA_TOKEN
    log("-- Push repo to gitea")
    exec(`cd ${name} && git push --force --all ${parsedURL.toString()}`)
  }
}

const start = async () => {
  // fetch gitea user info
  {
    log("-- Query gitea userinfo")
    const res = await gitea.get("/user")

    giteaUser = res.data.username

    log("-- Gitea user is: " + giteaUser)
  }

  // fetch github user info
  {
    log("-- Query github userinfo")
    const res = await octokit.request("GET /user")
    githubUser = res.data.login
    log("-- GitHub user is: " + githubUser)
  }

  // const runID = `backup-github.${fecha.format(
  //   new Date(),
  //   "isoDate"
  // )}.${Math.random().toString(16).slice(2, 8)}`
  const runID = "backup-github"
  const workDir = path.join(os.tmpdir(), runID)

  log("-- Create working dir")
  exec(`mkdir -p ${workDir}`)

  process.chdir(workDir)

  let page = 1
  while (true) {
    const repos = await fetchGithubRepos(page)

    if (repos.length === 0) break

    await backupRepos(repos)

    page += 1
  }
}

start()
