import { existsSync, readFileSync } from "fs"
import { join as joinPath } from "path"
import { GitHub } from "@actions/github/lib/utils"
import { Config, UploadDest } from "./config"
import * as upload from "./upload"
import * as util from "./util"
import * as models from "./models"

export type GitHub = InstanceType<typeof GitHub>

/**
 * Get or create a github release 
 */
export async function getRelease(config: Config, gh: GitHub): Promise<models.Release> {
  const tag = config.github_ref.replace("refs/tags/", "")
  const [owner, repo] = config.github_repository.split("/")

  let release;
  try {
    release = await gh.rest.repos.getReleaseByTag({owner, repo, tag})
    console.log(`Found an existing GitHub release for tag ${tag}`)
  } catch (error) {
    if (error.status !== 404) {
      throw error
    }
  }

  if (!release) {
    console.log(`Creating a new GitHub release for tag ${tag}`);
    release = await gh.rest.repos.createRelease({
      owner,
      repo,
      tag_name: tag,
      name: tag,
      generate_release_notes: true,
    });
  }

  return release.data
}

const NOTES_HEADER = "## :dizzy: Installation instructions"

function downloadUrl(config: Config, asset: models.ReleaseAsset): string {
  if (asset.type === "s3") {
    return asset.url
  } else {
    return config.public_release ? asset.browser_download_url : `https://api.github.com/repos/${config.github_repository}/releases/assets/${asset.id}`
  }
}

function downloadCreds(config: Config, asset: models.ReleaseAsset): string {
  return config.public_release ? "" : " creds=github"
}

export function generateNotes(config: Config, uploads: models.UploadResult[]): string {

  const autobuildInstallCommands = uploads.map(u =>
    `autobuild installables edit ${u.package.name} platform=${u.package.platform} url=${downloadUrl(config, u.asset)} hash_algorithm=sha1 hash=${u.package.sha1}${downloadCreds(config, u.asset)}`
  ).join("\n")

  return `${NOTES_HEADER}
  \`\`\`text
  ${autobuildInstallCommands}
  \`\`\``
}

export function uploaderFor(scheme: string, config: Config, gh: GitHub): upload.ArtifactUploader {
  switch (scheme) {
    case "s3":
      return new upload.S3ArtifactUploader(config)
    case "github-release":
      return new upload.GithubArtifactUploader(gh, config)
    default:
      throw Error(`Unknown upload scheme: ${scheme}`)
  }
} 

/**
* Preform release creation and asset upload 
*/
export async function autobuildRelease(config: Config, gh: GitHub) {
  // Download artifacts
  const artifacts = await util.getArtifacts()
  const autobuildArtifacts = artifacts.filter(a => existsSync(joinPath(a.downloadPath, "autobuild-results.json")))
  if (autobuildArtifacts.length === 0) {
    throw Error("No autobuild-results.json found in artifacts.") 
  }

  // Create or find release
  const release = await getRelease(config, gh)

  // Upload autobuild packages
  let uploads: models.UploadResult[] = []
  console.log(`Uploading to ${config.upload_to.length} destination(s)`)
  for (const dest of config.upload_to) {
    const uploader = uploaderFor(dest.scheme, config, gh)
    for (const artifact of autobuildArtifacts) {
      const upload = await uploader.upload({release, artifact, path: dest.path})
      if (upload) {
        uploads.push(upload)
      }
    }
  }

  // Select a single upload destination (s3 or release assets) to include in the autobuild
  // install instructions. We could make this configurable in the future.
  const assetTypeForInstructions = config.upload_to.length > 1 ? "s3" : "github-release" 

  // Create a pretty report
  const notes = generateNotes(config, uploads.filter(u => u.asset.type === assetTypeForInstructions))

  // Chop off prior instructions
  let body = release.body || "";
  const headerIdx = body.indexOf("Installation instruction")
  if (headerIdx !== undefined && headerIdx !== -1) {
    body = body.slice(0, headerIdx)
  }
  body = body ? body + "\n" + notes : notes

  const [owner, repo] = config.github_repository.split("/")
  gh.rest.repos.updateRelease({
    owner,
    repo,
    body,
    release_id: release.id,
  })
}
