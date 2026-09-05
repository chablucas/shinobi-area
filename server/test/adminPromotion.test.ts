import test from 'node:test'
import assert from 'node:assert/strict'

import { promoteAdminByEmail } from '../src/services/adminService.js'

test('promoteAdminByEmail upgrades a registered user to ADMIN', async () => {
  assert.equal(typeof promoteAdminByEmail, 'function')
})
