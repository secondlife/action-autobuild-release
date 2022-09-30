import * as artifactToolkit from '@actions/artifact';

export interface DownloadResponse {
    artifactName: string;
    downloadPath: string;
}

export function isTag(ref: string): boolean {
    return ref.startsWith("refs/tags/")
}

/**
 * Download all artifacts
 */
export async function getArtifacts(): Promise<DownloadResponse[]> {
    const client = artifactToolkit.create()
    return client.downloadAllArtifacts("artifacts")
}

export function basename(name: string): string {
    let i = name.lastIndexOf("\\")
    i = i === -1 ? name.lastIndexOf("/") : i
    if (i !== -1) {
        return name.slice(i + 1)
    }
    return name
}
