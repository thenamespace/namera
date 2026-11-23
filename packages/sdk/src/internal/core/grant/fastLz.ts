import * as Bytes from "ox/Bytes"
import * as Hex from "ox/Hex"

// FastLZ (level 1), as Solady's LibZip `flzCompress` (MIT License, Copyright (c) 2022 Solady): a TypeScript port of
// its JavaScript library (js/solady.js), which Smart Sessions' `flzDecompress` reads back.

const hash = (x: number) => ((2654435769 * x) >> 19) & 8191

/**
 * Compresses bytes with FastLZ, as Solady's `LibZip.flzCompress`.
 *
 * @internal
 */
export const compress = (data: Hex.Hex): Hex.Hex => {
  const input = Bytes.fromHex(data)
  const end = input.length - 4
  const table = new Map<number, number>()
  const output: Array<number> = []
  const u24 = (at: number) => input[at]! | (input[at + 1]! << 8) | (input[at + 2]! << 16)
  const literals = (runs: number, start: number) => {
    let from = start
    let remaining = runs
    while (remaining >= 32) {
      output.push(31)
      for (let count = 32; count > 0; count--, remaining--) output.push(input[from++]!)
    }
    if (remaining > 0) {
      output.push(remaining - 1)
      for (; remaining > 0; remaining--) output.push(input[from++]!)
    }
  }

  let anchor = 0
  let i = 2
  while (i < end - 9) {
    let reference = 0
    let distance = 0
    let sequence = 0
    let candidate = 0
    do {
      sequence = u24(i)
      const slot = hash(sequence)
      reference = table.get(slot) ?? 0
      table.set(slot, i)
      distance = i - reference
      candidate = distance < 8192 ? u24(reference) : 0x1000000
    } while (i < end - 9 && i++ && sequence !== candidate)
    if (i >= end - 9) break
    if (--i > anchor) literals(i - anchor, anchor)

    // Solady counts one past the first mismatch (the encoded length is the match length minus two).
    const limit = end - (i + 3)
    let length = 0
    while (length < limit && input[reference + 3 + length] === input[i + 3 + length]) length++
    if (length < limit) length++
    i += length
    distance--
    for (; length > 262; length -= 262) output.push(224 + (distance >> 8), 253, distance & 255)
    if (length < 7) output.push((length << 5) + (distance >> 8), distance & 255)
    else output.push(224 + (distance >> 8), length - 7, distance & 255)
    table.set(hash(u24(i)), i++)
    table.set(hash(u24(i)), i++)
    anchor = i
  }
  literals(end + 4 - anchor, anchor)
  return Hex.fromBytes(new Uint8Array(output))
}

/**
 * Decompresses FastLZ bytes, as Solady's `LibZip.flzDecompress`.
 *
 * @internal
 */
export const decompress = (data: Hex.Hex): Hex.Hex => {
  const input = Bytes.fromHex(data)
  const output: Array<number> = []
  let i = 0
  while (i < input.length) {
    const type = input[i]! >> 5
    if (type === 0) {
      for (let length = 1 + input[i++]!; length > 0; length--) output.push(input[i++]!)
      continue
    }
    const short = type < 7
    const offset = 256 * (input[i]! & 31) + input[i + 2 - (short ? 1 : 0)]!
    let length = short ? 2 + type : 9 + input[i + 1]!
    i += short ? 2 : 3
    let from = output.length - offset - 1
    while (length-- > 0) output.push(output[from++]!)
  }
  return Hex.fromBytes(new Uint8Array(output))
}
