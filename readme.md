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

## 特别鸣谢
1. [Shigma](https://github.com/shigma) - 提供 [代码参考](https://github.com/koishijs/koishi-plugin-market-info/blob/main/src/index.tsx#L95#L136)
2. [CyanChanges](https://github.com/CyanChanges/) - 技术指导
3. [Microsoft](https://github.com/Microsoft/) - 提供 [TypeScript](https://github.com/microsoft/typescript) & [VS Code](https://code.visualstudio.com/) & [Windows](https://www.microsoft.com/zh-cn/software-download/windows11) & [Microsoft Edge](https://aka.ms/msedge)
4. [Google](https://github.com/google) - 提供 [Chromium](https://github.com/chromium/chromium) & [Google Search Engine](https://google.com/ncr) & [Translator](https://translate.google.com)
5. [Discord](https://discord.com/) (由 [Cloudflare](https://cloudflare.com/) 内容分发) - 提供 语音聊天支持
6. [Vercel](https://vercel.lol/) - [对 Koishi 提供 文档支持](https://koishi.chat)
