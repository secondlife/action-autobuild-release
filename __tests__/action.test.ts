import nock from 'nock'
import { describe, test } from "@jest/globals"
import { loadConfig } from "../src/config"
import { getOctokit } from "@actions/github"
import * as os from "os"
import * as path from "path"
import * as fs from "fs"
import * as action from "../src/action"
import * as util from "../src/util"

// Spy on getArtifacts so that we can mock it
jest.spyOn(util, "getArtifacts")

const BOGUS_PACKAGE = path.join(__dirname, "data/bogus-0.1-common-111.tar.zst") 
const BOGUS_RESULTS = path.join(__dirname, "data/autobuild-results.json") 

/**
 * Create a fake workspace replete with autobuild artifacts, tear it down after callback
 * 
 * @param cb Callback
 */
async function inWorkspace(cb: (tmpDir: string, pkgDir: string) => Promise<void>) {
  const owd = process.cwd() 
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "autobuild-release-"))
  process.chdir(dir)
  const pkgDir = path.join(dir, "bogus-0.1-common-111")
  fs.mkdirSync(pkgDir)
  fs.copyFileSync(BOGUS_PACKAGE, path.join(pkgDir, util.basename(BOGUS_PACKAGE)))
  fs.copyFileSync(BOGUS_RESULTS, path.join(pkgDir, util.basename(BOGUS_RESULTS)))
  try {
    // Yield tmpDir, pkgDir
    await cb(dir, path.join(dir, "bogus-0.1-common-111"))
  } finally {
    process.chdir(owd)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function makeRelease(): action.Release {
  return {
    id: 1,
    upload_url: "",
    html_url: "",
    tag_name: "",
    name: "",
    body: "",
    target_commitish: "",
    draft: false,
    prerelease: false,
    assets: [],
  }
}

describe("getRelease", () => {
  const gh = getOctokit("TOKEN")
  const config = loadConfig({
    GITHUB_REPOSITORY: "secondlife/action-autobuild",
    GITHUB_REF: "refs/tags/v1.0.0",
  })

  test("a new release is created if one does not exist", async () => {
    nock("https://api.github.com")
      .get("/repos/secondlife/action-autobuild/releases/tags/v1.0.0")
      .reply(404)
      .post("/repos/secondlife/action-autobuild/releases")
      .reply(200, {
        "id": 2,
      })
      const release = await action.getRelease(config, gh)
      expect(release.id).toBe(2)
  })

  test("an existing release is used if it is available", async () => {
    nock("https://api.github.com")
      .get("/repos/secondlife/action-autobuild/releases/tags/v1.0.0")
      .reply(200, {
        "id": 1,
      })
      const release = await action.getRelease(config, gh)
      expect(release.id).toBe(1)
  })
})

describe("autobuildRelease", () => {
  const gh = getOctokit("TOKEN");
  const config = loadConfig({})

  test("release is aborted if there are no artifacts", async () => {
    jest.mocked(util.getArtifacts).mockReturnValue(Promise.resolve([]));
    await expect(action.autobuildRelease(config, gh))
      .rejects
      .toThrow("No autobuild-results.json found in artifacts.")
  })

  test("release is aborted if there are no autobuild artifacts", async () => {
    await inWorkspace(async (tmpDir) => {
      jest.mocked(util.getArtifacts).mockReturnValue(Promise.resolve([{
        artifactName: "foo",
        downloadPath: path.join(tmpDir, "foo"),
      }]))
      await expect(action.autobuildRelease(config, gh))
        .rejects
        .toThrow("No autobuild-results.json found in artifacts.")
      })
  })
})

describe("uploadArtifact", () => {
  const gh = getOctokit("TOKEN")
  const config = loadConfig({
    GITHUB_REPOSITORY: "secondlife/action-autobuild",
    GITHUB_REF: "refs/tags/v1.0.0",
  })

  test("upload is skipped if file is missing", async () => {
    const release = makeRelease()
    await inWorkspace(async (tmpDir, pkgDir) => {
      // Delete package
      fs.unlinkSync(path.join(pkgDir, util.basename(BOGUS_PACKAGE)))
      await expect(action.uploadArtifact(
          config,
          gh,
          release,
          {artifactName: "", downloadPath: pkgDir}
        ))
        .rejects
        .toThrow(/Missing .+bogus-0.1-common-111.tar.zst$/)
    })
  })
})
