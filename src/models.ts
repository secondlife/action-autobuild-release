import { GitHub } from "@actions/github/lib/utils"

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

export interface S3Asset {
  type: "s3"
  url: string
}

export interface GithubReleaseAsset {
  type: "github-release"
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

export type ReleaseAsset = S3Asset | GithubReleaseAsset

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

export interface DownloadResponse {
    artifactName: string;
    downloadPath: string;
}
