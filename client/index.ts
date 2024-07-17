import { Context } from '@koishijs/client'
import { receive } from '@koishijs/client'
import managePage from './vue/manage.vue'

const pathPrefix = '/update-service'

export default (ctx: Context) => {
    ctx.page({
        name: '管理自动更新 - update-service',
        path: pathPrefix + '/manage',
        component: managePage,
    })

    ctx.menu('update-service.manage', [])
}
