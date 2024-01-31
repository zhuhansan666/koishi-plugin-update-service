import { Context, Schema, Dict, Time, Logger, Service } from 'koishi'
import type { SearchObject, SearchResult } from '@koishijs/registry'
import { } from '@koishijs/plugin-market'

export const name = 'update-service'

export interface Config {
    interval: number
    endpoint: string
}

type Emptiable<T> = T | null | undefined | void

interface CallbacksDict {
    new: (shortname: string, version: string) => Emptiable<boolean>,
    update: (shortname: string, currentVersion: string, latestVersion: string) => Emptiable<boolean>,
    delete: (shortname: string) => Emptiable<boolean>,
}

export type Callbacks = Partial<CallbacksDict>

interface CallbacksDictPrivates {
    private: {
        verify: number  // verify code
        time: Date  // registry time
    }
}


export const Config: Schema<Config> = Schema.object({
    interval: Schema.number().default(Time.minute * 30).description('轮询间隔 (毫秒)'),
    endpoint: Schema.string().default('https://registry.koishi.chat/index.json').description('插件市场地址')
})

const logger = new Logger(name)

function randint(min: number, max: number): number {
    return Math.round(Math.min(min, max) + (Math.random() * Math.abs(max - min)))
}

export class Updater extends Service {
    private previous = null
    private registers: Map<string, Callbacks & CallbacksDictPrivates> = new Map()

    constructor(ctx: Context, config: Config) {
        super(ctx, 'updater', true)
        this.ctx.config = config  // fix it
    }

    async stop() {
        this.registers.clear()
    }

    private makeDict(result: SearchResult) {  // https://github.com/koishijs/koishi-plugin-market-info/blob/main/src/index.tsx#L46#L159
        const dict: Dict<SearchObject> = {}
        for (const object of result.objects) {  // 将隐藏的插件也算上
            dict[object.shortname] = object
        }
        return dict
    }

    private async getMarket(){
        const data = await this.ctx.http.get<SearchResult>(this.ctx.config.endpoint)
        return this.makeDict(data)
    }

    private callfunc(action: keyof Callbacks, name: string, currentVersion?: string, latestVersion?: string) {
        const func = (this.registers.get(name) ?? {})[action]
        if (func instanceof Function) {
            func(name, currentVersion, latestVersion)
            return
        }
    }

    protected async start(): Promise<void> {
        if (!this.previous) {
            this.previous = await this.getMarket()
        }

        this.ctx.setInterval(async () => {  // https://github.com/koishijs/koishi-plugin-market-info/blob/main/src/index.tsx#L95#L136
            const current = await this.getMarket()
            Object.keys({ ...this.previous, ...current })
            .map((name) => {
                const version1 = this.previous[name]?.package.version
                const version2 = current[name]?.package.version
                if (version1 === version2) return

                if (!version1) {  // 新增 name
                    logger.debug(`new plugin: ${name}`)
                    this.callfunc('new', name, version2)
                    return
                }

                if (version2) {  // 更新 version1 -> version2
                    logger.debug(`update plugin: ${name} (${version1} → ${version2})`)
                    this.callfunc('update', name, version1, version2)
                    return
                }

                // 删除 name
                logger.debug(`remove plugin: ${name}`)
                this.callfunc('delete', name)
                return
            })


            this.previous = current
        }, this.ctx.config.interval)
    }

    /**
     * 注册更新监听器
     * @param shortname 插件名称
     * @param callbacks 回调函数
     * @param force 强制, 覆盖原有回调函数
     * @returns 验证注册码
     */
    register(shortname: string, callbacks: Callbacks, force: boolean=false): number {
        if (this.registers.has(shortname) && !force) {
            throw Error(`register for ${shortname} has already exist, please use \`force = true\` to replace`)
        }

        const value: Callbacks & CallbacksDictPrivates = {
            ...callbacks,
            private: {
                verify: randint(0, 2147483648),
                time: new Date(),
            }
        }

        this.registers.set(shortname, value)

        this[Context.current]?.on('dispose', () => {
            // 插件随风消散之后取消注册
            this.unregister(shortname, value.private.verify)
        })

        return value.private.verify
    }

    /**
     * 解除注册更新监听器
     * @param shortname 插件名称
     * @param verifyCode 验证注册码
     * @returns 0 -> 成功; 255 -> unregistryCode 错误;
     */
    unregister(shortname: string, verifyCode: number): number {
        if (!this.registers.has(shortname)) {
            return 0;
        }

        const code = this.registers.get(shortname).private.verify
        if (code && verifyCode != code) {
            return 255;
        }

        this.registers.delete(shortname)
        return 0;
    }

    /**
     * 解除注册更新监听器
     * @param shortname 插件名称
     * @param verifyCode 验证注册码
     * @returns 0 -> 成功; 255 -> unregistryCode 错误;
     */
    update(shortname: string, verifyCode: number, callbacks: Callbacks): number {
        if (!this.registers.has(shortname)) {
            throw Error(`register for ${shortname} not found`)
        }

        const old = this.registers.get(shortname)
        const code = old.private.verify
        if (code && verifyCode != code) {
            return 255;
        }

        let value = Object.assign({}, old)
        value = Object.assign(value, callbacks)

        this.registers.set(shortname, value)
        return 0;
    }
}

declare module 'koishi' {
    interface Context {
        updater: Updater
    }
}

export function apply(ctx: Context, config: Config) {
    ctx.plugin(Updater, config)
}
