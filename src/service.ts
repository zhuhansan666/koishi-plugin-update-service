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
        this.ctx.on('updater/update', () => { this.refresh() })  // refresh data

        this.ctx.console.addListener('updater/config', (...args) => { this.updateConfig(...args) })
    }

    async get(forced?: boolean, client?: Client): Promise<Result> {
        return {
            data: Object.values(this.ctx.updater.getRegisters())
        }
    }

    updateConfig(shortname: string, config: MetadataType) {
        this.ctx.updater.updateConfig(commnicateKey, shortname, config)
    }
}

declare module '@koishijs/plugin-console' {
    namespace Console {
        interface Services {
            updater: UpdaterServiceProvider
        }
    }

    interface Events {
        'updater/config': (shortname: string, config: MetadataType) => void
    }
}
