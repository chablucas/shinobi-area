import { EXPECTED_CARD_COUNT, findDuplicates, scanCardAssets } from '../utils/cards.js'

const assets = await scanCardAssets()
const duplicateNames = findDuplicates(assets, 'name')
const duplicateSlugs = findDuplicates(assets, 'slug')
console.log(`Images valides : ${assets.length}`)
console.log(`Nombre attendu : ${EXPECTED_CARD_COUNT}`)
if (duplicateNames.length) console.error(`Doublons de noms : ${duplicateNames.join(', ')}`)
if (duplicateSlugs.length) console.error(`Doublons de slugs : ${duplicateSlugs.join(', ')}`)
if (assets.length !== EXPECTED_CARD_COUNT || duplicateNames.length || duplicateSlugs.length) process.exitCode = 1
else console.log('Vérification réussie.')