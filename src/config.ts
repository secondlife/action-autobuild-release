export interface UploadDest {
  scheme: "s3" | "github-release" 
  path: string
}

export interface Config {
  github_token: string
  github_ref: string
  github_repository: string
  // user provided
  public_release: boolean
  upload_to: UploadDest[]
}

export type Env = { [key: string]: string | undefined }

export function loadConfig(env: Env): Config {
  return {
    github_token: env.GITHUB_TOKEN || env.INPUT_TOKEN || "",
    github_ref: env.GITHUB_REF || "",
    github_repository: env.INPUT_REPOSITORY || env.GITHUB_REPOSITORY || "",
    public_release: env.INPUT_PUBLIC === "true",
    upload_to: (env["INPUT_UPLOAD-TO"] || "").split(/\r|\r?\n|,/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => {
        const parts = p.split("://", 2)
        switch (parts[0]) {
          case "github-release":
          case "s3":
            if (parts.length == 2) {
              return {scheme: parts[0], path: parts[1]}
            }
            return {scheme: parts[0], path: ""}
          default:
            throw Error(`Invalid upload_to scheme: ${p}. Accepted, s3:// or github-release://`)
          }
      })
  }
}
