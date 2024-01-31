import { Context, Schema, Dict, Time, Logger, Service } from 'koishi'
import type { SearchObject, SearchResult } from '@koishijs/registry'
import { } from '@koishijs/plugin-market'

export const name = 'update-service'

export const inject = {
    optional: ['console.market']
}

export interface Config {
    interval: number
    endpoint: string
}

type Emptiable<T> = T | null | undefined

export interface CallbacksDict {
    new: (shortname: string, version: string) => Emptiable<boolean>,
    update: (shortname: string, currentVersion: string, latestVersion: string) => Emptiable<boolean>,
    delete: (shortname: string) => Emptiable<boolean>,
}

type OptionalCallbacksDict = Partial<CallbacksDict>

interface CallbacksDictPrivates {
    private: {
        unregistry: number  // unregistry code
        time: Date  // registry time
    }
}


export const Config: Schema<Config> = Schema.object({
    interval: Schema.number().default(Time.minute * 30).description('轮询间隔 (毫秒)'),
    endpoint: Schema.string().default('https://registry.koishi.chat/index.json').description('插件市场地址')
})

const logger = new Logger(name)

// export function apply(ctx: Context, config: Config) {
//     ctx.plugin()
// }

class Updater extends Service {
    private previous = null
    readonly registersMap: Map<string, CallbacksDict & CallbacksDictPrivates> = new Map()

    constructor(ctx: Context) {
        super(ctx, name, true)
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

    private callfunc(control: keyof CallbacksDict, name: string, currentVersion?: string, latestVersion?: string) {
        const func = (this.registersMap.get(name) ?? {})[control]
        if (func instanceof Function) {
            func(name, currentVersion, latestVersion)
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
                    this.callfunc('update', version1, version2)
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
     * @returns 解除注册码
     */
    registry(shortname: string, callbacks: CallbacksDict, force: boolean=false): number {
        if (this.registersMap.has(shortname) && !force) {
            throw Error(`register for ${shortname} has already exist, please use \`force = true\` to replace`)
        }

        const value: CallbacksDict & CallbacksDictPrivates = {
            ...callbacks,
            private: {
                unregistry: 0,
                time: new Date(),
            }
        }

        this.registersMap.set(shortname, value)
    }

    /**
     * 解除注册更新监听器
     * @param shortname 插件名称
     * @param unregistryCode 解除注册码
     * @returns 0 -> 成功; 255 -> unregistryCode 错误;
     */
    unregistry(shortname: string, unregistryCode: number): number {
        if (!this.registersMap.has(shortname)) {
            return 0;
        }

        const code = this.registersMap.get(shortname).private.unregistry
        if (code && unregistryCode != code) {
            return 255;
        }

        this.registersMap.delete(shortname)
    }
}

declare module name {
    interface Context {
        updater: Updater
    }
}
