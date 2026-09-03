export type Card = {
  id: number
  name: string
  slug: string
  imageUrl: string | null
  stats: Record<string, number | null>
}

export type Category = {
  slug: string
  label: string
}