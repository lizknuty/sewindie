import { connection } from 'next/server'
import { createFormToken } from '@/lib/signup-guard'
import CreateAccountForm from './create-account-form'

export default async function CreateAccountPage() {
  // Each visit needs its own issue time so the server can tell how long the form was open.
  await connection()
  return <CreateAccountForm formToken={createFormToken()} />
}
