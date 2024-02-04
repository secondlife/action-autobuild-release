import * as models from  "./models"
import * as path from "path"
import * as util from "./util"
import { Config } from "./config"
import { existsSync, readFileSync } from "fs"
import { getType } from "mime"
import * as AWS from "@aws-sdk/client-s3";

export interface ArtifactUploadParams {
  release: models.Release,
  artifact: models.DownloadResponse
  path: string
}

export interface ArtifactUploader {
  upload: (params: ArtifactUploadParams) => Promise<models.UploadResult | null>
}

function readResults(filename: string): models.AutobuildResults {
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

export class S3ArtifactUploader implements ArtifactUploader {
  s3: AWS.S3

  constructor(private config: Config) {
    this.s3 = new AWS.S3({region: process.env.AWS_REGION || "us-east-1"})
  }

  async upload(params: ArtifactUploadParams): Promise<models.UploadResult | null> {
    const pkg = readResults(path.join(params.artifact.downloadPath, "autobuild-results.json"))
    const name = util.basename(pkg.filename)
    const packagePath = path.join(params.artifact.downloadPath, name)
    const packageType = getType(packagePath) || "application/octet-stream"

    const parts = params.path.split("/")
    const bucket = parts[0] 
    const prefix = parts.length == 1 ? "" : parts.slice(1).join("/") + "/"

    if (!existsSync(packagePath)) {
      throw Error(`Missing ${packagePath}`)
    }

    console.log(`⬆️ Uploading s3://${bucket}/${prefix}${name}...`);
    const req = new AWS.PutObjectCommand({
      ACL: this.config.public_release ? "public-read" : "private",
      Bucket: bucket,
      Key: `${prefix}${name}`,
      Body: readFileSync(packagePath),
      ContentType: packageType,
    })
    await this.s3.send(req)

    return {
      package: pkg,
      asset: {
        type: "s3",
        url: `https://${bucket}.s3.amazonaws.com/${prefix}${name}`,
      },
      mermaidGraphFile: path.join(params.artifact.downloadPath, "autobuild-graph.mermaid"),
    }
  }
}

export class GithubArtifactUploader implements ArtifactUploader {
  constructor(private gh: models.GitHub, private config: Config) {}

  async upload(params: ArtifactUploadParams): Promise<models.UploadResult | null> {
    const [owner, repo] = this.config.github_repository.split("/")
    const resultsFile = path.join(params.artifact.downloadPath, "autobuild-results.json") 
    const mermaidGraphFile = path.join(params.artifact.downloadPath, "autobuild-graph.mermaid")
    const pkg = readResults(resultsFile) 
    const name = util.basename(pkg.filename)
    const existingAsset = params.release.assets.find(a => a.name == name)
    const packagePath = path.join(params.artifact.downloadPath, name)
    const packageType = getType(packagePath) || "application/octet-stream"

    if (!existsSync(packagePath)) {
      throw Error(`Missing ${packagePath}`)
    }

    if (existingAsset) {
      console.log(`♻️ Deleting previously uploaded asset ${name}...`);
      await this.gh.rest.repos.deleteReleaseAsset({
        asset_id: existingAsset.id,
        owner,
        repo,
      })
    }

    console.log(`⬆️ Uploading ${name}...`);
    const res = await this.gh.rest.repos.uploadReleaseAsset({
      owner,
      repo,
      release_id: params.release.id,
      name: name,
      mediaType: {
        format: packageType,
      },
      data: readFileSync(packagePath) as unknown as string, // Yikes, https://github.com/octokit/octokit.js/issues/2086
    })

    return {
      package: pkg,
      asset: {type: "github-release", ...res.data},
      mermaidGraphFile: mermaidGraphFile,
    }
  }
}
