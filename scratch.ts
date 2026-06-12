import { readFileSync } from 'fs'
import { DOMParser } from 'xmldom'

const musicXml = readFileSync('public/demo2.musicxml', 'utf-8')
const doc = new DOMParser().parseFromString(musicXml, 'application/xml')
const harmonies = Array.from(doc.getElementsByTagName('harmony'))

harmonies.forEach((harmony) => {
  const kind = harmony.getElementsByTagName('kind')[0]
  const rootStep = harmony
    .getElementsByTagName('root-step')[0]
    ?.textContent?.trim()
  const rootAlter = Number(
    harmony.getElementsByTagName('root-alter')[0]?.textContent || '0'
  )
  console.log({
    rootStep,
    rootAlter,
    kind: kind?.textContent,
  })
})
