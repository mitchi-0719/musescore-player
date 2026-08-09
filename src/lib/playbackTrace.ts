let traceSequence = 0

export const tracePlayback = (
  source: string,
  event: string,
  values: Record<string, unknown> = {}
) => {
  traceSequence += 1
  console.log(
    `[playback-trace] ${JSON.stringify({
      sequence: traceSequence,
      timestamp: new Date().toISOString(),
      source,
      event,
      ...values,
    })}`
  )
}
