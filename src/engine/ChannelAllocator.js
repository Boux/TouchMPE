/**
 * MPE Channel Allocator — manages member channels (MIDI channels 1–15, i.e. indices 1–15).
 * Channel 0 (MIDI Ch1) is always the master channel.
 * Uses round-robin allocation with LRU voice stealing when full.
 */
export default class ChannelAllocator {
  constructor(memberCount = 15) {
    this.setMemberCount(memberCount)
  }

  setMemberCount(count) {
    this.memberCount = Math.max(1, Math.min(15, count))
    this.available = new Set()
    for (let i = 1; i <= this.memberCount; i++) {
      this.available.add(i)
    }
    // channel → { pointerId, note, timestamp }
    this.active = new Map()
    this.lastAllocated = 0
  }

  /**
   * Allocate a channel for a new note.
   * Returns { channel, stolen } where stolen is the note info if voice stealing occurred.
   */
  allocate(pointerId, note) {
    let channel = null
    let stolen = null

    if (this.available.size > 0) {
      channel = this._nextAvailable()
      this.available.delete(channel)
    } else {
      // Voice stealing: find oldest active note
      let oldestTime = Infinity
      let oldestChannel = null
      for (const [ch, info] of this.active) {
        if (info.timestamp < oldestTime) {
          oldestTime = info.timestamp
          oldestChannel = ch
        }
      }
      channel = oldestChannel
      stolen = { ...this.active.get(channel) }
    }

    this.active.set(channel, {
      pointerId,
      note,
      timestamp: performance.now()
    })
    this.lastAllocated = channel

    return { channel, stolen }
  }

  release(channel) {
    this.active.delete(channel)
    if (channel >= 1 && channel <= this.memberCount) {
      this.available.add(channel)
    }
  }

  channelForPointer(pointerId) {
    for (const [ch, info] of this.active) {
      if (info.pointerId === pointerId) return ch
    }
    return null
  }

  _nextAvailable() {
    for (let i = 1; i <= this.memberCount; i++) {
      const ch = ((this.lastAllocated + i - 1) % this.memberCount) + 1
      if (this.available.has(ch)) return ch
    }
    return this.available.values().next().value
  }
}
