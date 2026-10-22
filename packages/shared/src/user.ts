/** The public view of a player, safe to send to other clients. */
export interface PublicUser {
  id: string
  name: string
  image: string | null
  isGuest: boolean
}
