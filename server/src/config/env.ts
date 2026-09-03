import 'dotenv/config'

export const env = {
  port: Number(process.env.PORT ?? 3000),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  if (
    origin === env.clientUrl ||
    origin === 'http://localhost:5173' ||
    origin === 'https://shinobi-area.vercel.app'
  ) return true
  return /^https:\/\/[^.]+-5173\.app\.github\.dev$/.test(origin)
}

export function requireDatabaseUrl(): string {
  if (!env.databaseUrl) throw new Error('DATABASE_URL is required')
  return env.databaseUrl
}

export function requireJwtSecret(): string {
  if (!env.jwtSecret) throw new Error('JWT_SECRET is required')
  return env.jwtSecret
}

export function requireCloudinaryConfig() {
  const { cloudName, apiKey, apiSecret } = env.cloudinary
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required')
  }
  return { cloudName, apiKey, apiSecret }
}