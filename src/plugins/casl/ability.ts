import { createMongoAbility } from '@casl/ability'

export interface Rule {
  action: string
  subject: string
}

export const ability = createMongoAbility()
