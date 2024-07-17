import { Client, DataService } from '@koishijs/plugin-console'
import { CallbackMetadata2Client, MetadataType } from '.'
import { Context, Dict } from 'koishi'
import { commnicateKey } from '../const'

interface Result {
    data: Array<CallbackMetadata2Client>
}

export default class UpdaterServiceProvider extends DataService<Result> {
    static inject = [...DataService.inject, 'updater']

    constructor(ctx: Context) {
        super(ctx, 'updater')
        // 这个 update 不是指更新插件, 而是刷新数据
        this.ctx.on('updater/update', () => { this.refresh() })  // refresh data

        this.ctx.console.addListener('updater/config', (...args) => { this.updateConfig(...args) })
        // this.ctx.console.addListener('updater/reload-plugin', (...args) => { this.reload(...args) })
    }

    async get(forced?: boolean, client?: Client): Promise<Result> {
        // 不需要 update 因为没有缓存
        return {
            data: Object.values(this.ctx.updater.getRegisters())
        }
    }

    updateConfig(shortname: string, config: MetadataType) {
        this.ctx.updater.updateConfig(commnicateKey, shortname, config)
    }

    // reload(pluginCtx: Context) {
    //     /* 切勿使用内部 API
    //     // callback 接受 parent, key(配置文件中插件名称), config(配置)
    //     // https://github.com/koishijs/webui/tree/main/plugins/config/src/shared/writer.ts#L9
    //     // this.ctx.console.listeners['manager/reload'].callback('', `${pluginCtx.name}:${webuid}`, pluginCtx.config)
    //     */

    //     this.ctx.installer.
    // }
}

declare module '@koishijs/plugin-console' {
    namespace Console {
        interface Services {
            updater: UpdaterServiceProvider
        }
    }

    interface Events {
        'updater/config': (shortname: string, config: MetadataType) => void,
    }
}
