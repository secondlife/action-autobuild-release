import { existsSync, readFileSync } from "fs"
import { join as joinPath } from "path"
import { GitHub } from "@actions/github/lib/utils"
import { Config } from "./config"
import { getType } from "mime"
import * as path from "path"
import * as util from "./util"

export type GitHub = InstanceType<typeof GitHub>

export interface Release {
  id: number
  upload_url: string
  html_url: string
  tag_name: string
  name: string | null
  body?: string | null | undefined
  target_commitish: string
  draft: boolean
  prerelease: boolean
  assets: Array<{ id: number; name: string }>
}

export interface ReleaseAsset {
  url: string
  browser_download_url: string
  id: number
  node_id: string
  name: string
  label: string | null
  state: "uploaded" | "open" 
  content_type: string
  size: number
  download_count: number 
  created_at: string
  updated_at: string
}

export interface AutobuildResults {
  filename: string
  name: string
  clean: string
  metadata: string
  platform: string 
  md5: string
  blake2b: string
  sha1: string
  sha256: string
}

export interface UploadResult {
  package: AutobuildResults
  asset: ReleaseAsset
  mermaidGraphFile: string
}

function readResults(filename: string): AutobuildResults {
  const results = JSON.parse(readFileSync(filename, "utf8"))
  return {
    blake2b: results["autobuild_package_blake2b"],
    clean: results["autobuild_package_clean"],
    filename: results["autobuild_package_filename"],
    md5: results["autobuild_package_md5"],
    metadata: results["autobuild_package_metadata"],
    name: results["autobuild_package_name"],
    platform: results["autobuild_package_platform"],
    sha1: results["autobuild_package_sha1"],
    sha256: results["autobuild_package_sha256"],
  }
}

/**
 * Get or create a github release 
 */
export async function getRelease(config: Config, gh: GitHub): Promise<Release> {
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

/**
 * Upload artifacts to a release
 */
export async function uploadArtifact(
  config: Config,
  gh: GitHub,
  release: Release,
  artifact: util.DownloadResponse
): Promise<UploadResult | null> {
  const [owner, repo] = config.github_repository.split("/")
  const resultsFile = path.join(artifact.downloadPath, "autobuild-results.json") 
  const mermaidGraphFile = path.join(artifact.downloadPath, "autobuild-graph.mermaid")
  const pkg = readResults(resultsFile) 
  const name = util.basename(pkg.filename)
  const existingAsset = release.assets.find(a => a.name == name)
  const packagePath = path.join(artifact.downloadPath, name)
  const packageType = getType(packagePath) || "application/octet-stream"

  if (!existsSync(packagePath)) {
    throw Error(`Missing ${packagePath}`)
    return null
  }

  if (existingAsset) {
    console.log(`♻️ Deleting previously uploaded asset ${name}...`);
    await gh.rest.repos.deleteReleaseAsset({
      asset_id: existingAsset.id,
      owner,
      repo,
    })
  }

  console.log(`⬆️ Uploading ${name}...`);
  const res = await gh.rest.repos.uploadReleaseAsset({
    owner,
    repo,
    release_id: release.id,
    name: name,
    mediaType: {
      format: packageType,
    },
    data: readFileSync(packagePath) as unknown as string, // Yikes, https://github.com/octokit/octokit.js/issues/2086
  })

  return {
    package: pkg,
    asset: res.data,
    mermaidGraphFile: mermaidGraphFile,
  }
}

const NOTES_HEADER = "## :dizzy: Installation instructions"

export function generateNotes(config: Config, uploads: UploadResult[]): string {
  const creds = config.public_release ? "" : " creds=github"

  const autobuildInstallCommands = uploads.map(u =>
    `autobuild installables edit ${u.package.name} platform=${u.package.platform} url=${u.asset.browser_download_url} hash_algorithm=sha1 hash=${u.package.sha1}${creds}`
  ).join("\n")

  return `${NOTES_HEADER}
  \`\`\`text
  ${autobuildInstallCommands}
  \`\`\``
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
  let uploads: UploadResult[] = []
  for (const artifact of autobuildArtifacts) {
    const upload = await uploadArtifact(config, gh, release, artifact)
    if (upload) {
      uploads.push(upload)
    }
  }

  // Create a pretty report
  const notes = generateNotes(config, uploads)

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
