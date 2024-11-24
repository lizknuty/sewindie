import { Bebas_Neue, Old_Standard_TT } from 'next/font/google'

export const bebas = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

export const oldStandard = Old_Standard_TT({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
})