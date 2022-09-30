export interface Config {
  github_token: string
  github_ref: string
  github_repository: string
  // user provided
  public_release: boolean
}

export type Env = { [key: string]: string | undefined }

export function loadConfig(env: Env): Config {
  return {
    github_token: env.GITHUB_TOKEN || env.INPUT_TOKEN || "",
    github_ref: env.GITHUB_REF || "",
    github_repository: env.INPUT_REPOSITORY || env.GITHUB_REPOSITORY || "",
    public_release: env.INPUT_PUBLIC === "true",
  }
}
