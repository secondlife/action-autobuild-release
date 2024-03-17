import { DefaultArtifactClient } from '@actions/artifact';
import * as models from "./models"

export function isTag(ref: string): boolean {
    return ref.startsWith("refs/tags/")
}

/**
 * Download all artifacts
 */
export async function getArtifacts(): Promise<models.DownloadResponse[]> {
    const client = new DefaultArtifactClient() 
    const res = await client.listArtifacts()
    const artifacts: models.DownloadResponse[] = []
    for (const artifact of res.artifacts) {
        const path = basename(artifact.name)
        const downloadRes = await client.downloadArtifact(artifact.id, {path})
        console.log(`Downloaded artifact ${artifact.name} to ${downloadRes.downloadPath}`)
        artifacts.push({ artifactName: artifact.name, downloadPath: downloadRes.downloadPath ?? "" })
    }
    return artifacts
}

export function basename(name: string): string {
    let i = name.lastIndexOf("\\")
    i = i === -1 ? name.lastIndexOf("/") : i
    if (i !== -1) {
        return name.slice(i + 1)
    }
    return name
}
