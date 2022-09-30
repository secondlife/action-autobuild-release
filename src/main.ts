import * as core from "@actions/core"
import { getOctokit } from "@actions/github"
import { loadConfig, Env } from "./config"
import { autobuildRelease } from "./action"
import { isTag } from "./util"

export async function run(env: Env = process.env): Promise<void> {
    const config = loadConfig(process.env);
    if (!isTag(config.github_ref)) {
      throw new Error(`⚠️ Autobuild Release requires a tag`)
    }
    const gh = getOctokit(config.github_token)
    await autobuildRelease(config, gh)
  }

async function main(): Promise<void> {
  try {
    core.startGroup("Autobuild Release")
    await run();
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      throw error
    }
  } finally {
    core.endGroup()
  }
}

main()
