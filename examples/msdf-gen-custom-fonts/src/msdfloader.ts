import { GenerateFontResult, MSDF } from '@zappar/msdf-generator'
import * as THREE from 'three'
import { suspend, preload, clear } from 'suspend-react'

export type MSDFResult = GenerateFontResult

import workerUrl from '@zappar/msdf-generator/worker.js?worker&url'
import wasmUrl from '@zappar/msdf-generator/msdfgen_wasm.wasm?url'

export interface MSDFLoaderOptions {
  charset?: string
  fontSize?: number
  textureSize?: [number, number]
  fieldRange?: number
  fixOverlaps?: boolean
  onProgress?: (progress: number, completed: number, total: number) => void
}

export interface MSDFLoaderBatchOptions extends MSDFLoaderOptions {
  fonts?: Partial<MSDFLoaderOptions>[]
}

const _DEFAULT_OPTIONS: Required<Omit<MSDFLoaderOptions, 'onProgress'>> = {
  charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?.,;:\'"()-[]{}@#$%&*+=/\\<>',
  fontSize: 48,
  textureSize: [512, 512],
  fieldRange: 4,
  fixOverlaps: true,
}

class MSDFLoader extends THREE.Loader {
  private _options: MSDFLoaderOptions = {}

  constructor(manager?: THREE.LoadingManager) {
    super(manager)
  }

  setOptions(options: MSDFLoaderOptions): this {
    this._options = options
    return this
  }

  override async loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<MSDFResult> {
    const loader = new THREE.FileLoader(this.manager)
    loader.setResponseType('arraybuffer')
    loader.setPath(this.path)
    loader.setRequestHeader(this.requestHeader)
    loader.setWithCredentials(this.withCredentials)

    const generator = new MSDF({
      workerUrl,
      wasmUrl,
    })

    try {
      const [arrayBuffer] = await Promise.all([loader.loadAsync(url, onProgress), generator.initialize()])
      const finalOptions = { ..._DEFAULT_OPTIONS, ...this._options }
      const fontBuffer = new Uint8Array(arrayBuffer as ArrayBuffer)

      return await generator.generate({
        font: fontBuffer,
        charset: finalOptions.charset,
        fontSize: finalOptions.fontSize,
        textureSize: finalOptions.textureSize,
        fieldRange: finalOptions.fieldRange,
        fixOverlaps: finalOptions.fixOverlaps,
        ...(finalOptions.onProgress ? { onProgress: finalOptions.onProgress } : {}),
      })
    } catch (err) {
      throw new Error(`MSDF generation failed for ${url}: ${(err as Error).message}`)
    } finally {
      generator.dispose()
    }
  }

  async loadMultipleAsync(
    urls: string[],
    options: MSDFLoaderBatchOptions = {},
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<MSDFResult> {
    if (urls.length === 0) throw new Error('No URLs provided')

    const loader = new THREE.FileLoader(this.manager)
    loader.setResponseType('arraybuffer')
    loader.setPath(this.path)
    loader.setRequestHeader(this.requestHeader)
    loader.setWithCredentials(this.withCredentials)

    const generator = new MSDF()

    try {
      const fontPromises = urls.map((url) => loader.loadAsync(url, onProgress))
      const [arrayBuffers] = await Promise.all([Promise.all(fontPromises), generator.initialize()])

      const { fonts: perFontOptions, onProgress: progressCallback, ...globalOptions } = options
      const finalGlobalOptions = { ..._DEFAULT_OPTIONS, ...globalOptions }

      const fonts = arrayBuffers.map((arrayBuffer, i) => {
        const fontOverrides = perFontOptions?.[i] ?? {}
        const mergedOptions = { ...finalGlobalOptions, ...fontOverrides }

        return {
          font: new Uint8Array(arrayBuffer as ArrayBuffer),
          charset: mergedOptions.charset,
          fontSize: mergedOptions.fontSize,
          textureSize: mergedOptions.textureSize,
          fieldRange: mergedOptions.fieldRange,
          fixOverlaps: mergedOptions.fixOverlaps,
        }
      })

      const generateOptions = {
        fonts,
        charset: finalGlobalOptions.charset,
        fontSize: finalGlobalOptions.fontSize,
        ...(progressCallback ? { onProgress: progressCallback } : {}),
      } as any

      return await generator.generate(generateOptions)
    } catch (err) {
      throw new Error(`MSDF batch generation failed: ${(err as Error).message}`)
    } finally {
      generator.dispose()
    }
  }
}

function loadingFn(
  input: string | string[],
  options: MSDFLoaderBatchOptions | MSDFLoaderOptions | MSDFLoaderOptions[],
) {
  return async () => {
    const urls = Array.isArray(input) ? input : [input]
    const loader = new MSDFLoader()

    if (urls.length === 1) {
      const opts = Array.isArray(options) ? (options[0] ?? {}) : options
      loader.setOptions(opts)
      return await loader.loadAsync(urls[0]!)
    }

    const isBatchOptions = !Array.isArray(options) && 'fonts' in options
    const batchOptions: MSDFLoaderBatchOptions = isBatchOptions
      ? (options as MSDFLoaderBatchOptions)
      : { fonts: Array.isArray(options) ? options : urls.map(() => options) }

    return await loader.loadMultipleAsync(urls, batchOptions)
  }
}

export function useMSDF(input: string, options?: MSDFLoaderOptions): MSDFResult
export function useMSDF(input: string[], options?: MSDFLoaderBatchOptions | MSDFLoaderOptions[]): MSDFResult
export function useMSDF(
  input: string | string[],
  options: MSDFLoaderBatchOptions | MSDFLoaderOptions | MSDFLoaderOptions[] = {},
): MSDFResult {
  const urls = Array.isArray(input) ? input : [input]
  const isBatchOptions = !Array.isArray(options) && urls.length > 1 && 'fonts' in options
  const isArrayOptions = Array.isArray(options)

  let optionsArray: MSDFLoaderOptions[]

  if (isBatchOptions) {
    const { fonts: perFontOptions, ...globalOpts } = options as MSDFLoaderBatchOptions
    optionsArray = urls.map((_, i) => ({ ...globalOpts, ...(perFontOptions?.[i] ?? {}) }))
  } else if (isArrayOptions) {
    optionsArray = urls.map((_, i) => options[i] ?? {})
  } else {
    optionsArray = urls.map(() => options as MSDFLoaderOptions)
  }

  const keys = urls.map((url, i) => [url, JSON.stringify(optionsArray[i])])

  return suspend(loadingFn(input, options), ['msdf', ...keys.flat()]) as MSDFResult
}

useMSDF.preload = (
  input: string | string[],
  options: MSDFLoaderBatchOptions | MSDFLoaderOptions | MSDFLoaderOptions[] = {},
): void => {
  const urls = Array.isArray(input) ? input : [input]
  const optionsArray = Array.isArray(options) ? options : Array.isArray(input) ? urls.map(() => options) : [options]
  const keys = urls.map((url, i) => [url, JSON.stringify(optionsArray[i] ?? {})])
  return preload(loadingFn(input, options), ['msdf', ...keys.flat()])
}

useMSDF.clear = (
  input: string | string[],
  options: MSDFLoaderBatchOptions | MSDFLoaderOptions | MSDFLoaderOptions[] = {},
): void => {
  const urls = Array.isArray(input) ? input : [input]
  const optionsArray = Array.isArray(options) ? options : Array.isArray(input) ? urls.map(() => options) : [options]
  const keys = urls.map((url, i) => [url, JSON.stringify(optionsArray[i] ?? {})])
  return clear(['msdf', ...keys.flat()])
}
