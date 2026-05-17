import { useState } from 'react'

export const useOnOffState = (initialValue: boolean = false) => {
  const [state, setState] = useState(initialValue)
  const turnOn = () => setState(true)
  const turnOff = () => setState(false)
  const toggle = () => setState((prev) => !prev)

  return { state, turnOn, turnOff, toggle }
}
