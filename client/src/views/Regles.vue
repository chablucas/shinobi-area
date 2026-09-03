<script setup lang="ts">
import SocialHeader from '../components/SocialHeader.vue'

const categories = ['Chakra', 'Invocation', 'IQ', 'Ninjutsu', 'Genjutsu', 'Taijutsu', 'Avatar', 'Body', 'Fûinjutsu', 'Senjutsu', 'Kenjutsu', 'Clan', 'Vitesse', 'Kekkei Genkai', 'Kekkei Mōra']
const sections = [
  { id: 'general', title: 'Général', text: 'Construis un shinobi en choisissant une carte par catégorie. Les cartes tirées et leurs compatibilités déterminent les possibilités de ton build et la victoire.' },
  { id: 'categories', title: 'Catégories', text: 'Chaque emplacement conserve son rôle. Le Clan fournit des permissions et bonus, tandis que les autres emplacements portent les statistiques et techniques correspondantes.' },
  { id: 'ninjutsu', title: 'Ninjutsu', text: 'Le Ninjutsu est évalué par une attaque et une défense distinctes. Les règles existantes peuvent modifier ces deux valeurs selon le build et l’adversaire.' },
  { id: 'clans', title: 'Clans', text: 'Les permissions et bonus de clan sont appliqués par les règles du moteur. Ils peuvent autoriser certaines compatibilités, notamment autour du Sharingan et du Rinnegan.' },
  { id: 'avatars', title: 'Avatars', text: 'Les avatars sont vérifiés selon leurs compatibilités et leurs conditions. Les effets propres aux Bijû et les contraintes du Jûbi restent ceux du moteur actuel.' },
  { id: 'genkai', title: 'Kekkei Genkai', text: 'Les capacités Kekkei Genkai sont prises en compte dans le build et dans les permissions existantes, sans transformer le Clan en statistique numérique.' },
  { id: 'mora', title: 'Kekkei Mōra', text: 'Les capacités Kekkei Mōra et leurs interactions sont traitées par les règles dédiées du moteur, y compris les conditions particulières déjà définies.' },
  { id: 'bonus', title: 'Bonus / Malus', text: 'Les bonus et malus du combat sont appliqués une seule fois par le moteur. Ils peuvent être proportionnels ou en points selon la règle concernée.' },
  { id: 'conditions', title: 'Conditions spéciales', text: 'Les conditions liées aux cartes, aux permissions, aux valeurs parfaites et à l’adversaire produisent les validations ou effets prévus par les règles existantes.' },
  { id: 'combat', title: 'Combat', text: 'Le moteur calcule les statistiques de base, applique les règles, additionne le score final et expose les erreurs de validation. Le score le plus élevé remporte le combat.' },
  { id: 'modes', title: 'Modes de jeu', text: 'Shinobi Area propose les parties contre l’IA, les duels 1v1 et les parties 1v1v1. Les salons sociaux utilisent les modes configurés par le serveur.' },
]
</script>

<template>
  <main class="rules-page"><SocialHeader /><section class="rules-layout"><aside class="rules-nav"><p class="eyebrow">Manuel de l’arène</p><h1>RÈGLES</h1><a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ section.title }}</a></aside><article class="rules-content"><section v-for="section in sections" :id="section.id" :key="section.id" class="rule-section"><p class="eyebrow">{{ String(sections.indexOf(section) + 1).padStart(2, '0') }}</p><h2>{{ section.title }}</h2><p>{{ section.text }}</p><div v-if="section.id === 'categories'" class="category-list"><span v-for="category in categories" :key="category">{{ category }}</span></div></section></article></section></main>
</template>

<style scoped>
.rules-page { min-height: 100vh; background: var(--bg-main); }.rules-layout { display: grid; grid-template-columns: 250px minmax(0, 820px); gap: 64px; max-width: 1180px; margin: 0 auto; padding: 64px 20px 100px; }.rules-nav { position: sticky; top: 20px; align-self: start; }.rules-nav h1 { margin: 10px 0 24px; color: var(--accent-orange); font-size: 3rem; }.rules-nav a { display: block; padding: 8px 0; border-bottom: 1px solid var(--border-light); color: var(--text-muted); font-size: .62rem; }.rules-nav a:hover { color: var(--accent-gold); }.rules-content { display: grid; gap: 16px; }.rule-section { padding: 28px; border-left: 2px solid var(--accent-orange); background: var(--bg-panel); }.rule-section h2 { margin: 8px 0 12px; color: var(--text-main); font-size: 1.45rem; }.rule-section > p:last-of-type { color: var(--text-muted); line-height: 1.75; font-size: .72rem; }.category-list { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 18px; }.category-list span { padding: 8px 10px; border: 1px solid var(--border-light); color: var(--accent-gold); font-size: .58rem; }@media (max-width: 720px) { .rules-layout { display: block; padding-top: 36px; }.rules-nav { position: static; margin-bottom: 30px; }.rules-nav a { display: inline-block; margin: 0 12px 8px 0; border: 0; } }
</style>
