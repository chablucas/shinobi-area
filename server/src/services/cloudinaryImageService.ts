import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { readdir } from 'node:fs/promises'
import { requireCloudinaryConfig } from '../config/env.js'
import { slugify, type CloudinaryZipAsset } from '../utils/cards.js'

const CLOUDINARY_FOLDER = 'Shinobi-area'
const execFileAsync = promisify(execFile)
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

export type CloudinaryCardImage = CloudinaryZipAsset & {
  displayName: string
  assetFolder: string
  format: string
}

async function findArchive(): Promise<string> {
  const files = await readdir(path.resolve(process.cwd(), '..'))
  const archives = files.filter((file) => /^Shinobi-area.*\.zip$/i.test(file))
  if (archives.length !== 1) throw new Error(`Archive Cloudinary attendue introuvable ou multiple (${archives.length}).`)
  return path.resolve(process.cwd(), '..', archives[0])
}

export function cloudinaryDeliveryUrl(fileName: string): string {
  const { cloudName } = requireCloudinaryConfig()
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${encodeURIComponent(fileName)}`
}

export function clearCloudinaryImageCache() {
  return undefined
}

export async function readCloudinaryZipImages(): Promise<CloudinaryCardImage[]> {
  const archive = await findArchive()
  const { stdout } = await execFileAsync('unzip', ['-Z1', archive])
  const fileNames = stdout.split('\n').map((entry) => path.posix.basename(entry.trim())).filter((fileName) => IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
  return fileNames.sort().map((fileName) => {
    const stem = path.basename(fileName, path.extname(fileName))
    return { fileName, publicId: stem, secureUrl: cloudinaryDeliveryUrl(fileName), name: stem, slug: slugify(stem), displayName: fileName, assetFolder: CLOUDINARY_FOLDER, format: path.extname(fileName).slice(1).toLowerCase() }
  })
}

export async function validateCloudinaryImageUrls(images: CloudinaryCardImage[]): Promise<string[]> {
  const failures: string[] = []
  for (const image of images) {
    try {
      const response = await fetch(image.secureUrl)
      const contentType = response.headers.get('content-type') ?? ''
      await response.body?.cancel()
      if (response.status !== 200 || !contentType.toLowerCase().startsWith('image/')) failures.push(`${image.fileName} (${response.status}, ${contentType || 'content-type absent'})`)
    } catch {
      failures.push(`${image.fileName} (requête impossible)`)
    }
  }
  return failures
}