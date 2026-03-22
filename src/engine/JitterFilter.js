/**
 * 1-Euro Filter — speed-adaptive low-pass filter for touch input smoothing.
 *
 * At low speeds (finger stationary): strong smoothing eliminates jitter.
 * At high speeds (fast slides): minimal smoothing preserves responsiveness.
 *
 * Parameters:
 *   minCutoff: minimum cutoff frequency (Hz). Lower = smoother at rest. Default 1.0
 *   beta: speed coefficient. Higher = less lag during fast movement. Default 0.007
 *   dCutoff: cutoff for derivative filter. Default 1.0
 */
export default class JitterFilter {
  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
    this.xPrev = null
    this.dxPrev = 0
    this.tPrev = null
  }

  reset() {
    this.xPrev = null
    this.dxPrev = 0
    this.tPrev = null
  }

  filter(x, timestamp) {
    if (this.xPrev === null) {
      this.xPrev = x
      this.tPrev = timestamp
      return x
    }

    const dt = Math.max((timestamp - this.tPrev) / 1000, 0.001) // seconds
    this.tPrev = timestamp

    // Derivative of the signal
    const dx = (x - this.xPrev) / dt

    // Filter the derivative
    const alphaD = this._smoothingFactor(dt, this.dCutoff)
    const dxHat = alphaD * dx + (1 - alphaD) * this.dxPrev
    this.dxPrev = dxHat

    // Adaptive cutoff based on speed
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat)

    // Filter the signal
    const alpha = this._smoothingFactor(dt, cutoff)
    const xHat = alpha * x + (1 - alpha) * this.xPrev
    this.xPrev = xHat

    return xHat
  }

  _smoothingFactor(dt, cutoff) {
    const tau = 1 / (2 * Math.PI * cutoff)
    return 1 / (1 + tau / dt)
  }
}

/**
 * Bundle of 1-Euro filters for X, Y, and pressure per touch.
 */
export class TouchFilter {
  constructor() {
    this.x = new JitterFilter(1.0, 0.007)
    this.y = new JitterFilter(1.0, 0.007)
    this.pressure = new JitterFilter(0.5, 0.001) // smoother for pressure
  }

  reset() {
    this.x.reset()
    this.y.reset()
    this.pressure.reset()
  }

  filterPos(x, y, timestamp) {
    return {
      x: this.x.filter(x, timestamp),
      y: this.y.filter(y, timestamp)
    }
  }

  filterPressure(p, timestamp) {
    return this.pressure.filter(p, timestamp)
  }
}
