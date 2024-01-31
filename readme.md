# koishi-plugin-update-service

[![npm](https://img.shields.io/npm/v/koishi-plugin-update-service?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-update-service)

本插件提供了 `updater` 服务

## 使用方法 (以 [systools-lts](https://github.com/zhuhansan666/koishi-plugin-systools-lts) 为例)

* ### 注册检查更新回调函数
```ts
import {  } from 'koishi-plugin-update-service'  // 合并类型

...

export function apply() {
    ...

    const verifyCode = ctx.updater.register(
        'systools-lts',
        {
            new: (name: string, verison: string) => {
                // 在该插件新增时回调
                ...
            },
            update: (name: string, verison: string, latest: string) => {
                // 在插件版本更新时回调
                ...
            },
            delete: (name: string) => {
                // 在插件被删除后回调
                ...
            }
        }
    )
}
```

* ### 注销检查更新回调函数
```ts
import {  } from 'koishi-plugin-update-service'  // 合并类型

...

export function apply() {
    ...

    // verifyCode 是 register 的返回值
    ctx.updater.unregister('systools-lts', verifyCode)
}
```

* ### 更新检查更新回调函数
```ts
import {  } from 'koishi-plugin-update-service'  // 合并类型

...

export function apply() {
    ...

    // verifyCode 是 register 的返回值
    ctx.updater.update(
        'systools-lts',
        {  // 于 register 参数相同, 但可选填部分 key
            ...
        }
    )
}
```
