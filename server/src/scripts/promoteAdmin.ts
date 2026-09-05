import { prisma } from '../config/prisma.js'
import { promoteAdminByEmail } from '../services/adminService.js'

const email = process.argv[2]?.trim().toLowerCase()

if (!email) {
  console.error('Usage: npm run admin:promote -- <email>')
  process.exit(1)
}

const user = await prisma.user.findUnique({ where: { email } })
if (!user) {
  console.error(`L’utilisateur ${email} n’existe pas encore. Créez-le avant d’exécuter la promotion admin.`)
  process.exit(1)
}

const result = await promoteAdminByEmail(email)
if (!result.promoted || !result.user) {
  console.error(`Impossible de promouvoir ${email}.`)
  process.exit(1)
}

console.log(`Compte admin promu: ${result.user.email} (${result.user.role})`)
await prisma.$disconnect()
