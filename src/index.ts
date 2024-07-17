import { Context, Schema, Dict, Time, Service, Random, Get } from 'koishi'
import type { SearchObject, SearchResult } from '@koishijs/registry'
import { } from '@koishijs/plugin-market'
import UpdaterServiceProvider from './service'
import { resolve } from 'path'
import { commnicateKey } from '../const'
import { Persistencer } from './persistence'

import { } from '@koishijs/plugin-market'

export const name = 'update-service'

export const inject = ['installer']

type Nullable<T> = T | null | undefined | void

interface CallbacksDictFunctions {
    new: (shortname: Shortname, version: CurrentVersion) => Nullable<boolean>,
    update: (shortname: Shortname, currentVersion: CurrentVersion, latestVersion: LatestVersion) => Nullable<boolean>,
    delete: (shortname: Shortname) => Nullable<void>,
}

interface CallbacksDictPrivates {
    private: {
        verify: number  // verify code
    },
}

export interface CallbackMetadata {
    metadata: {
        time: string  // registry time
        config: {
            allowInstall: boolean,
            allowReceiveMessage: boolean,
        }
    }
}

export type CallbackMetadata2Client = CallbackMetadata & {
    name: string
}

export type Callbacks = Partial<CallbacksDictFunctions>
type CallbacksDict = Callbacks & CallbacksDictPrivates
type CallbacksDictWithMetadata = CallbacksDict & CallbackMetadata

type Shortname = string
type Fullname = string
type Version = string
type CurrentVersion = Version
type LatestVersion = Version
type InstallTask = Array<Fullname | LatestVersion>

export type MetadataType = Get<Get<CallbackMetadata2Client, 'metadata'>, 'config'>

export interface Config {
    interval: number
    endpoint: string

    enablePermissionSystem: boolean
}

export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
        interval: Schema.number().default(Time.minute * 30).description('轮询间隔 (毫秒)'),
        endpoint: Schema.string().default('https://registry.koishi.chat/index.json').description('插件市场地址'),
    }).description('服务配置'),
    Schema.object({
        enablePermissionSystem: Schema.boolean().default(false).description('启用权限系统').experimental()
    }).description('其他配置')
])

function randint(min: number, max: number): number {
    return Random.int(Math.min(min, max), Math.max(min, max))
}

export class Updater extends Service {
    private previous = null
    private installTasks: Array<InstallTask> = []
    private registers: Map<string, CallbacksDictWithMetadata> = new Map()
    private persistencer: Persistencer
    private endpoint: string
    static readonly databaseFile

    constructor(ctx: Context, config: Config) {
        super(ctx, 'updater', true)
        this.ctx.config = config  // fix it
        this.endpoint = config.endpoint

        this.persistencer = new Persistencer(resolve(this.ctx.baseDir, 'data/update-service/store.json'))
    }

    stop() {
        this.registers.clear()
    }

    getRegisters(): Dict<CallbackMetadata2Client, string> {
        const result = {}
        this.registers.forEach((value, key) => {
            result[key] = {
                name: key,
                metadata: value.metadata
            }
        })

        return result
    }

    private makeDict(result: SearchResult) {  // https://github.com/koishijs/koishi-plugin-market-info/blob/main/src/index.tsx#L46#L59
        const dict: Dict<SearchObject> = {}
        for (const obj of result.objects) {  // 将隐藏的插件也算上
            dict[obj.shortname] = obj
        }
        return dict
    }

    private async getMarket() {
        const data = await this.ctx.http.get<SearchResult>(this.endpoint)
        return this.makeDict(data)
    }

    async #install() {
        // install it
        if (!this.installTasks.length) {
            return
        }

        const deps = {}
        const promises = []

        while (this.installTasks.length > 0) {
            const [fullname, verison] = this.installTasks.shift()
            this.logger.debug(`update package info: ${fullname}: ${verison}`)

            const promise = this.ctx.installer['_getPackage'](fullname)
            this.ctx.installer['pkgTasks'][fullname] = promise
            promises.push(promises)

            deps[fullname] = verison
        }

        Promise.all(promises)

        this.logger.debug(`installing`)
        const status = await this.ctx.installer.install(deps, true)
        this.logger.debug(`install status: ${status}`)
        return status
    }

    private async callfunc(fullname: string, action: keyof Callbacks, name: string, currentVersion?: string, latestVersion?: string) {
        const value: CallbacksDictWithMetadata | undefined = this.registers.get(name)
        const func = value?.[action]

        // not allow receive update/new/delete message -> skip call func
        if (this.ctx.config.enablePermissionSystem && value?.metadata.config.allowReceiveMessage === false) {
            return
        }

        if (func instanceof Function) {
            const res = func(name, currentVersion, latestVersion)

            // res is not true or not allow install -> skip install
            if (!this.ctx.config.enablePermissionSystem) {
                return
            }

            if (res !== true || value.metadata.config.allowInstall === false) {
                return
            }
        } else {
            return
        }

        // install it
        // this.ctx.installer.refresh(true)  // 刷新插件市场的包
        let latest = currentVersion
        if (latestVersion) {
            latest = latestVersion
        }

        this.installTasks.push([fullname, latest])
    }

    // mergeData(data: object) {

    // }

    // async init() {
    //     const data = await this.persistencer.load()
    //     if (data) {
    //         this.mergeData(data)
    //     }
    // }

    protected async start(): Promise<void> {
        // await this.init()

        if (!this.previous) {
            this.previous = await this.getMarket()
        }

        this.ctx.setInterval(async () => {  // https://github.com/koishijs/koishi-plugin-market-info/blob/main/src/index.tsx#L95#L136
            const current = await this.getMarket()
            await Promise.all(
                Object.keys({ ...this.previous, ...current })
                    .map(async (name) => {
                        const version1 = this.previous[name]?.package.version
                        const version2 = current[name]?.package.version
                        if (version1 === version2) return

                        const fullname = this.previous[name]?.package.name ?? current[name]?.package.name

                        if (!version1) {  // 新增 name
                            this.logger.debug(`new plugin: ${name}`)
                            await this.callfunc(fullname, 'new', name, version2)
                            return
                        }

                        if (version2) {  // 更新 version1 -> version2
                            this.logger.debug(`update plugin: ${name} (${version1} → ${version2})`)
                            await this.callfunc(fullname, 'update', name, version1, version2)
                            return
                        }

                        // 删除 name
                        this.logger.debug(`remove plugin: ${name}`)
                        await this.callfunc(fullname, 'delete', name)
                        return
                    })
            )
            const promise = this.#install()
            this.previous = current

            await promise
        }, this.ctx.config.interval)
    }

    async checkUpdate(pluginCtx: Context, fullname: Fullname): Promise<Nullable<LatestVersion>> {
        const value: CallbacksDictWithMetadata | undefined = this.registers.get(pluginCtx.name)
        const updateConfig = value.metadata.config
        if (!updateConfig.allowReceiveMessage) {
            this.logger.debug(`plugin ${pluginCtx.name} has not allow receive message`)
            return
        }

        const current = await this.getMarket()
        
        const latestVersion = current[fullname]?.package.version
        const currentVersion = this.previous[fullname]?.package.version

        const result = latestVersion === currentVersion ? null : latestVersion
        this.previous = current
        return result
    }

    async install(pluginCtx: Context, fullname: Fullname, version: string): Promise<number> {
        const value: CallbacksDictWithMetadata | undefined = this.registers.get(pluginCtx.name)
        const updateConfig = value.metadata.config
        if (!updateConfig.allowReceiveMessage || !updateConfig.allowInstall) {
            return 255
        }

        this.installTasks.push([fullname, version])
        return this.#install()
    }

    /**
     * 注册更新监听器
     * @param pluginCtx 插件上下文实例
     * @param callbacks 回调函数
     * @param force 强制, 覆盖原有回调函数
     * @returns 验证注册码
     */
    register(pluginCtx: Context, callbacks: Callbacks, force: boolean = false): number {
        const shortname = pluginCtx.name
        const old = this.registers.get(shortname)
        if (old && old.new && old.update && old.delete && !force) {
            throw Error(`register for ${shortname} has already exist, please use \`force = true\` to replace`)
        }

        const metadata = old?.metadata ?? {
            time: new Date().toISOString(),
            config: {
                allowInstall: false,
                allowReceiveMessage: true
            }
        }

        const value: CallbacksDictWithMetadata = {
            ...callbacks,
            private: {
                verify: randint(0, 2147483648),
            },
            metadata: metadata
        }

        this.registers.set(shortname, value)
        this.ctx.emit('updater/update')

        this[Context.current]?.on('dispose', () => {
            // 插件随风消散之后取消注册
            this.unregister(pluginCtx, value.private.verify)
        })

        return value.private.verify
    }

    /**
     * 解除注册更新监听器
     * @param pluginCtx 插件上下文实例
     * @param verifyCode 验证注册码
     * @returns 0 -> 成功; 255 -> unregistryCode 错误;
     */
    unregister(pluginCtx: Context, verifyCode: number): number {
        const shortname = pluginCtx.name
        if (!this.registers.has(shortname)) {
            return 0;
        }

        const code = this.registers.get(shortname).private.verify
        if (code && verifyCode != code) {
            return 255;
        }

        this.registers.delete(shortname)
        this.ctx.emit('updater/update')
        return 0;
    }

    /**
     * 解除注册更新监听器
     * @param pluginCtx 插件上下文实例
     * @param verifyCode 验证注册码
     * @returns 0 -> 成功; 255 -> unregistryCode 错误;
     */
    update(pluginCtx: Context, verifyCode: number, callbacks: Callbacks): number {
        const shortname = pluginCtx.name

        if (!this.registers.has(shortname)) {
            throw Error(`register for ${shortname} not found`)
        }

        const old = this.registers.get(shortname)
        const code = old?.private?.verify
        if (code && verifyCode != code) {
            return 255;
        }

        let value = Object.assign({}, old)
        value = Object.assign(value, callbacks)

        this.registers.set(shortname, value)
        this.ctx.emit('updater/update')
        return 0;
    }

    updateConfig(key: string, shortname: string, config: MetadataType) {
        if (key !== commnicateKey) {
            throw Error('key error')
        }

        const old = this.registers.get(shortname)
        const oldConfig = Object.assign({}, old?.metadata?.config)
        const newConfig = {} as any
        Object.keys(oldConfig).forEach((key) => {
            if (config[key] !== undefined) {
                newConfig[key] = config[key]
            }
            config[key] = oldConfig[key]
        })

        old.metadata.config = newConfig

        const printOld = Object.assign({}, old)
        delete printOld.private
        this.logger.debug(`updated config: `, printOld)
        this.registers.set(shortname, old)
        this.ctx.emit('updater/update')
    }
}

declare module 'koishi' {
    interface Context {
        updater: Updater
    }

    interface Events {
        'updater/update': () => void
    }
}

export function apply(ctx: Context, config: Config) {
    ctx.plugin(Updater, config)

    if (config.enablePermissionSystem) {
        ctx.plugin(UpdaterServiceProvider)

        ctx.inject(['console'], (ctx) => {
            ctx.console.addEntry({
                dev: resolve(__dirname, '../client/index.ts'),
                prod: resolve(__dirname, '../dist'),
            })
        })
    }
}

export * from './service'
